import asyncio
import json
import time

import pytest
from fastapi.testclient import TestClient

from server.auth import password_hash, password_matches
from server.db import Database, uid
from server.engine import compact_messages
from server.main import create_app
from server.plans import PLANS, reserve, today, usage
from server.provider import Provider, ProviderError, uid_call
from server.strategy import route
from server.tools import ToolError, ToolRegistry, calculate, safe_path, validate_content


class FixtureProvider:
    """Deterministic integration fixture, never a production model."""
    ready = True
    calls = 0

    def models(self):
        return [{"id": "fast", "provider_model": "test-fixture", "label": "TEST ONLY", "tier": "fast"}]

    def tier(self, model):
        return model

    async def complete(self, messages, tools, model, output_tokens, cancel=lambda:False):
        self.calls += 1
        if "artifact" in messages[1]["content"].lower():
            replies = [m for m in messages if m["role"] == "tool"]
            if len(replies) == 0:
                return {"role":"assistant", "content":None,"tool_calls":[{
                    "id":"write-1","type":"function","function":{"name":"write_file",
                    "arguments":json.dumps({"path":"answer.json","content":'{"answer":42}'})}}]}, {}
            if len(replies) == 1:
                return {"role":"assistant","content":None,"tool_calls":[{
                    "id":"validate-1","type":"function","function":{"name":"validate_file",
                    "arguments":json.dumps({"path":"answer.json"})}}]}, {}
            return {"role":"assistant","content":"Created and JSON-parsed answer.json."}, {"total_tokens":10}
        return {"role":"assistant","content":"Fixture reply, not live AI."}, {"total_tokens":5}


@pytest.fixture
def setup(tmp_path):
    db = Database(str(tmp_path / "test.db"))
    provider = FixtureProvider()
    app = create_app(db, provider)
    with TestClient(app) as client:
        yield db, provider, client


def signup(client, email="one@example.com"):
    r = client.post("/api/auth/signup",json={"email":email,"password":"correct-horse-2026","name":"Test"})
    assert r.status_code == 200, r.text
    d = r.json()
    return d["user"], {"Authorization":"Bearer "+d["token"]}


def test_password_hashes_are_salted():
    a,b=password_hash("long-password"),password_hash("long-password")
    assert a!=b and password_matches("long-password",a) and not password_matches("wrong",a)


def test_signup_never_grants_owner_or_paid_plan(setup):
    db,p,c=setup
    u,h=signup(c)
    assert u["role"]=="user" and u["plan"]=="free"
    assert c.post("/api/auth/signup",json={"email":"x@y.com","password":"long-password","role":"owner"}).status_code==422


def test_auth_ignores_visitor_header(setup):
    db,p,c=setup
    signup(c)
    c.cookies.clear()
    assert c.get("/api/auth/me",headers={"X-Visitor-Id":"vknown"}).status_code==401


def test_login_logout_and_password_revoke(setup):
    db,p,c=setup
    u,h=signup(c)
    assert c.post("/api/auth/login",json={"email":u["email"],"password":"wrong"}).status_code==401
    assert c.post("/api/auth/password",headers=h,json={"current":"correct-horse-2026","next":"new-correct-password"}).status_code==200
    assert c.get("/api/auth/me",headers=h).status_code==401
    r=c.post("/api/auth/login",json={"email":u["email"],"password":"new-correct-password"})
    h={"Authorization":"Bearer "+r.json()["token"]}
    assert c.post("/api/auth/logout",headers=h,json={}).status_code==200
    assert c.get("/api/auth/me",headers=h).status_code==401


def test_user_cannot_change_plan_or_owner(setup):
    db,p,c=setup
    u,h=signup(c)
    assert c.patch("/api/admin/users/"+u["id"],headers=h,json={"plan":"ultra"}).status_code==403
    assert c.put("/api/prefs",headers=h,json={"plan":"ultra","role":"owner"}).status_code==200
    assert db.one("SELECT plan,role FROM users WHERE id=?",(u["id"],))=={"plan":"free","role":"user"}


def test_owner_plan_management_and_last_owner(setup):
    db,p,c=setup
    u,h=signup(c)
    db.execute("UPDATE users SET role='owner' WHERE id=?",(u["id"],))
    assert c.patch("/api/admin/users/"+u["id"],headers=h,json={"plan":"plus"}).status_code==200
    assert c.patch("/api/admin/users/"+u["id"],headers=h,json={"role":"user"}).status_code==409
    assert c.patch("/api/admin/users/"+u["id"],headers=h,json={"plan":"invented"}).status_code==400


def test_chat_sse_persistence_and_cross_user_isolation(setup):
    db,p,c=setup
    u,h=signup(c)
    r=c.post("/api/chat",headers=h,json={"message":"hello","model":"fast"})
    assert r.status_code==200 and "Fixture reply" in r.text and "event: done" in r.text
    chats=c.get("/api/chats",headers=h).json()
    assert len(chats)==1
    chat_id=chats[0]["id"]
    assert len(c.get("/api/chats/"+chat_id,headers=h).json()["messages"])==2
    other,h2=signup(c,"other@example.com")
    assert c.get("/api/chats/"+chat_id,headers=h2).status_code==404
    assert c.get(f"/api/agent/{chat_id}/zip",headers=h2).status_code==404
    run=db.one("SELECT id FROM runs WHERE chat_id=?",(chat_id,))["id"]
    assert c.get("/api/runs/"+run,headers=h2).status_code==404


def test_chat_rename_pin_search_archive(setup):
    db,p,c=setup
    u,h=signup(c)
    c.post("/api/chat",headers=h,json={"message":"hello"})
    chat=c.get("/api/chats",headers=h).json()[0]["id"]
    assert c.patch("/api/chats/"+chat,headers=h,json={"title":"Important","pinned":1}).status_code==200
    assert len(c.get("/api/chats?q=important",headers=h).json())==1
    c.patch("/api/chats/"+chat,headers=h,json={"archived":1})
    assert c.get("/api/chats",headers=h).json()==[]


def test_provider_missing_no_fake_output_or_quota(setup):
    db,p,c=setup
    u,h=signup(c)
    p.ready=False
    r=c.post("/api/chat",headers=h,json={"message":"hello"})
    assert r.status_code==503 and "provider_not_configured" in r.text
    assert usage(db,u)=={}
    assert c.get("/api/chats",headers=h).json()==[]


def test_free_agent_and_advanced_model_blocked(setup):
    db,p,c=setup
    u,h=signup(c)
    assert c.post("/api/chat",headers=h,json={"message":"do task","mode":"agent"}).status_code==403
    assert c.post("/api/chat",headers=h,json={"message":"hello","model":"advanced"}).status_code==403
    assert p.calls==0


def test_quota_before_provider_call(setup):
    db,p,c=setup
    u,h=signup(c)
    db.execute("INSERT INTO usage VALUES (?,?,?,?)",(u["id"],today(),"messages",20))
    assert c.post("/api/chat",headers=h,json={"message":"hi"}).status_code==429
    assert p.calls==0


def test_quota_transaction_rolls_back_all_metrics(setup):
    db,p,c=setup
    u,h=signup(c)
    db.execute("UPDATE users SET plan='plus' WHERE id=?",(u["id"],))
    u=db.one("SELECT * FROM users WHERE id=?",(u["id"],))
    db.execute("INSERT INTO usage VALUES (?,?,?,?)",(u["id"],today(),"agent",10))
    with pytest.raises(Exception):
        with db.transaction(u["id"]):
            reserve(db,u,"agent")
    assert usage(db,u).get("messages",0)==0


def test_real_artifact_tool_pipeline(setup):
    db,p,c=setup
    u,h=signup(c)
    db.execute("UPDATE users SET plan='plus' WHERE id=?",(u["id"],))
    r=c.post("/api/chat",headers=h,json={"message":"create an artifact file","mode":"agent"})
    assert r.status_code==200, r.text
    assert '"status": "completed"' in r.text
    assert "event: evaluation" in r.text and "event: done" in r.text
    chat=c.get("/api/chats",headers=h).json()[0]["id"]
    file=c.get(f"/api/agent/{chat}/file?path=answer.json",headers=h)
    assert file.status_code==200 and json.loads(file.text)=={"answer":42}
    assert c.get(f"/api/agent/{chat}/zip",headers=h).content[:2]==b"PK"
    run=c.get("/api/runs",headers=h).json()[0]
    evidence=c.get("/api/runs/"+run["id"],headers=h).json()
    assert any(e["kind"]=="tool" for e in evidence["events"])
    assert "checkpoint" not in evidence


def test_unsupported_media_no_quota(setup):
    db,p,c=setup
    u,h=signup(c)
    assert c.post("/api/chat",headers=h,json={"message":"image","mode":"image"}).status_code==422
    assert usage(db,u)=={}


def test_memory_consent_and_tenant_isolation(setup):
    db,p,c=setup
    u,h=signup(c)
    assert c.get("/api/memory",headers=h).status_code==403
    db.execute("UPDATE users SET plan='pro' WHERE id=?",(u["id"],))
    assert c.post("/api/memory",headers=h,json={"text":"Prefer Arabic"}).status_code==400
    r=c.post("/api/memory",headers=h,json={"text":"Prefer Arabic","consent":True})
    assert r.status_code==200
    other,h2=signup(c,"two@example.com")
    db.execute("UPDATE users SET plan='pro' WHERE id=?",(other["id"],))
    assert c.get("/api/memory",headers=h2).json()==[]
    c.delete("/api/memory/"+r.json()["id"],headers=h2)
    assert len(c.get("/api/memory",headers=h).json())==1
    c.delete("/api/memory/"+r.json()["id"],headers=h)
    assert c.get("/api/memory",headers=h).json()==[]


def test_json_preference_cannot_smuggle_memory_consent(setup):
    db,p,c=setup
    u,h=signup(c)
    assert c.put("/api/prefs",headers=h,json={"memory_opt_in":"yes"}).status_code==400


@pytest.mark.parametrize("path",["../secret","/etc/passwd","a/../b","a\\b",".env","a//b","C:/secret","a/.hidden"])
def test_reject_unsafe_paths(path):
    with pytest.raises(ToolError):
        safe_path(path)


@pytest.mark.parametrize("expression",["__import__('os')","2**10000","1/0","[1,2]","True","(1).__class__"])
def test_arithmetic_not_code_execution(expression):
    with pytest.raises(ToolError):
        calculate(expression)


@pytest.mark.parametrize("expr,value",[("2+3*4",14),("(9-3)/2",3),("-4+2",-2),("2**8",256)])
def test_calculator(expr,value):
    assert calculate(expr)["value"]==value


def test_validation_boundaries():
    assert validate_content("a.json",'{"x":1}')["method"]=="json-parse"
    with pytest.raises(ValueError):
        validate_content("a.json",'{wrong}')
    with pytest.raises(ToolError):
        validate_content("a.csv","a,b\n1")
    assert "Not browser" in validate_content("index.html","<html></html>")["limitation"]
    assert "Not semantic" in validate_content("code.py","bad python syntax")["limitation"]


def test_tool_idempotency_and_edit_match(setup):
    db,p,c=setup
    u,h=signup(c)
    u["plan"]="plus"
    registry=ToolRegistry(db,u,"chat")
    async def scenario():
        args={"path":"a.json","content":'{"ok":true}'}
        first=await registry.execute("write_file",args,call_id="call1",run_id="run")
        second=await registry.execute("write_file",args,call_id="call1",run_id="run")
        assert first==second
        with pytest.raises(ToolError):
            await registry.execute("edit_file",{"path":"a.json","old":"missing","new":"x"},call_id="call2",run_id="run")
        with pytest.raises(ToolError):
            await registry.execute("shell",{},call_id="call3",run_id="run")
    asyncio.run(scenario())
    assert db.one("SELECT COUNT(*) AS n FROM files")["n"]==1


def test_workflow_dependencies_and_evidence(setup):
    db,p,c=setup
    u,h=signup(c)
    u["plan"]="pro"
    registry=ToolRegistry(db,u,"chat")
    async def call(nodes,key):
        return await registry.execute("update_workflow",{"nodes":nodes},call_id=key,run_id="run")
    def node(name,status="pending",deps=None,evidence=None):
        return {"node_id":name,"objective":name,"status":status,"dependencies":deps or [],
                "acceptance":["Real output"],"evidence":evidence or []}
    async def scenario():
        await call([node("a"),node("b",deps=["a"])],"graph1")
        with pytest.raises(ToolError):
            await call([node("a",deps=["b"])],"cycle")
        with pytest.raises(ToolError):
            await call([node("a","completed")],"fakecomplete")
        with pytest.raises(ToolError):
            await call([node("b","running",deps=["a"])],"early")
        result=await registry.execute("calculate",{"expression":"6*7"},call_id="proof",run_id="run")
        await call([node("a","completed",evidence=[result["evidence_id"]])],"completea")
        updated=await call([node("b","running",deps=["a"])],"runb")
        assert len(updated["nodes"])==2
        with pytest.raises(ToolError):
            await call([node("c","completed",evidence=["invented"])],"fakeproof")
    asyncio.run(scenario())


def test_file_read_is_bounded(setup):
    db,p,c=setup
    u,h=signup(c)
    u["plan"]="plus"
    registry=ToolRegistry(db,u,"chat")
    async def scenario():
        await registry.execute("write_file",{"path":"a.txt","content":"x"*14000},call_id="write",run_id="run")
        result=await registry.execute("read_file",{"path":"a.txt","offset":1000,"limit":100},call_id="read",run_id="run")
        assert len(result["content"])==100 and result["truncated"]
    asyncio.run(scenario())


def test_context_compaction_has_no_orphan_tool_results():
    messages=[{"role":"system","content":"policy"},{"role":"user","content":"objective"}]
    for i in range(6):
        messages.extend([{"role":"assistant","content":None,"tool_calls":[{"id":str(i)}]},
                         {"role":"tool","tool_call_id":str(i),"content":"x"*500}])
    out=compact_messages(messages,1600)
    seen=set()
    for m in out:
        if m["role"]=="assistant":
            seen.update(c["id"] for c in m.get("tool_calls",[]))
        if m["role"]=="tool":
            assert m["tool_call_id"] in seen
    assert out[0]["content"]=="policy" and out[1]["content"]=="objective"


@pytest.mark.parametrize("text,expected",[
    ("Hello","direct"),
    ("What does HTTP mean?","direct"),
    ("Debug this Python traceback","hypothesis-driven"),
    ("أصلح خطأ في هذا الكود","hypothesis-driven"),
    ("Research latest climate sources","research-first"),
    ("ابحث عن أحدث الأخبار","research-first"),
    ("create a HTML artifact file","incremental-implementation"),
    ("أنشئ ملف تقرير","artifact-first"),
    ("calculate sum of dataset","data-driven"),
    ("احسب تحليل البيانات","data-driven"),
    ("architecture for scalable service","comparative-evaluation"),
    ("Why is this unknown?","investigate"),
])
def test_strategy_evaluations(text,expected):
    assert route(text,["calculate","fetch_page"])["strategy"]==expected


def test_mixed_profiles_and_unsupported_operations():
    d=route("Research and debug a Python codebase, create a report, deploy it",["read_file"])
    assert {"research","debugging","coding","artifact","operations"} <= set(d["profiles"])
    assert d["risk"]=="approval" and len(d["limitations"])==2


def test_plans_increase_strictly():
    for key in ("messages","agent","research","steps","files","context"):
        values=[PLANS[p][key] for p in ("free","plus","pro","ultra")]
        assert values==sorted(values) and len(set(values))>=3


def test_uuid_identifiers_unique_and_v7():
    import uuid
    values=[uid_call() for _ in range(100)]
    assert len(set(values))==100 and all(uuid.UUID(x).version==7 for x in values)


def test_serverless_rejects_ephemeral_storage(setup,monkeypatch):
    db,p,c=setup
    monkeypatch.setenv("VERCEL","1")
    assert c.get("/api/health").status_code==200
    assert c.post("/api/auth/signup",json={"email":"x@y.com","password":"long-password"}).status_code==503


def test_credential_fields_never_exposed(setup):
    db,p,c=setup
    u,h=signup(c)
    db.execute("UPDATE users SET role='owner' WHERE id=?",(u["id"],))
    response=c.get("/api/admin/settings",headers=h)
    assert "password" not in response.text and "token" not in response.text
    assert c.put("/api/admin/settings",headers=h,json={"geminiKey":"not-a-real-key"}).status_code==422


def test_generate_image_saves_downloadable_file(setup, monkeypatch):
    # Synthetic provider response: proves the tool wiring, not a live Gemini call.
    import base64
    from server.provider import Provider
    png = base64.b64encode(b"\x89PNG fixture").decode()
    async def fake(self, prompt, cancel=lambda: False):
        return "image/png", png
    monkeypatch.setattr(Provider, "generate_image", fake)
    db,p,c=setup
    u,h=signup(c)
    u["plan"]="pro"
    registry=ToolRegistry(db,u,"chat")
    async def scenario():
        result=await registry.execute("generate_image",{"prompt":"a red cube","path":"img/cube.png"},call_id="img1",run_id="run")
        assert result["path"]=="img/cube.png" and result["verified"]
        read=await registry.execute("read_file",{"path":"img/cube.png"},call_id="img2",run_id="run")
        assert read["type"]=="image"
        with pytest.raises(ToolError):
            await registry.execute("edit_file",{"path":"img/cube.png","old":"x","new":"y"},call_id="img3",run_id="run")
    asyncio.run(scenario())
    u["plan"]="plus"
    assert "generate_image" not in ToolRegistry(db,u,"chat").available()


def test_image_tool_is_not_advertised_without_gemini_credentials(setup, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("CUSTOM_CRED_GENERATIVELANGUAGE_GOOGLEAPIS_COM_URL", raising=False)
    monkeypatch.delenv("CUSTOM_CRED_GENERATIVELANGUAGE_GOOGLEAPIS_COM_PROXY_AUTH_KEY", raising=False)
    db, _, client = setup
    user, headers = signup(client)
    db.execute("UPDATE users SET plan='pro' WHERE id=?", (user["id"],))
    current_user = db.one("SELECT * FROM users WHERE id=?", (user["id"],))
    assert "generate_image" not in ToolRegistry(db, current_user, "chat").available()
