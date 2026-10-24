import asyncio
import json

import httpx
import pytest

from server.db import Database
from server.provider import Provider, ProviderError


@pytest.fixture
def transport(monkeypatch):
    original = httpx.AsyncClient
    calls = []
    def install(handler):
        async def wrapped(request):
            calls.append(request)
            return handler(request)
        monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: original(
            *a, **kw, transport=httpx.MockTransport(wrapped)))
    return install, calls


def test_gemini_discovery_and_tool_signature_roundtrip(monkeypatch, tmp_path, transport):
    monkeypatch.setenv("GEMINI_API_KEY", "test-placeholder-not-real")
    db=Database(str(tmp_path/"catalog.db"))
    provider=Provider(db)
    install,calls=transport
    def handler(request):
        if request.method=="GET":
            return httpx.Response(200,json={"models":[
                {"name":"models/example-flash","displayName":"Example Flash","supportedGenerationMethods":["generateContent"]},
                {"name":"models/example-embedding","supportedGenerationMethods":["embedContent"]},
                {"name":"models/example-image","supportedGenerationMethods":["generateContent"]},
                {"name":"models/example-pro","supportedGenerationMethods":["generateContent"]}]})
        body=json.loads(request.content)
        if not body.get("tools"):
            return httpx.Response(200,json={"candidates":[{"content":{"parts":[{"text":"APEX_OK"}]}}]})
        return httpx.Response(200,json={"candidates":[{"content":{"parts":[
            {"functionCall":{"name":"calculate","args":{"expression":"6*7"}},"thoughtSignature":"fixture-signature"}]}}],
            "usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":5}})
    install(handler)
    async def scenario():
        result=await provider.discover()
        assert len(result["discovered"])==2
        model="gemini:example-flash"
        message,spent=await provider.complete([{"role":"system","content":"Rules"},{"role":"user","content":"6*7"}],[],model,100)
        assert message["tool_calls"][0]["function"]["name"]=="calculate"
        assert message["native_parts"][0]["thoughtSignature"]=="fixture-signature"
        assert spent["input_tokens"]==10
        await provider.complete([{"role":"system","content":"Rules"},{"role":"user","content":"6*7"},
            message,{"role":"tool","tool_call_id":message["tool_calls"][0]["id"],"content":'{"value":42}'}],[],model,100)
        sent=json.loads(calls[-1].content)
        assert sent["contents"][1]["parts"][0]["thoughtSignature"]=="fixture-signature"
        assert sent["contents"][2]["parts"][0]["functionResponse"]["name"]=="calculate"
    asyncio.run(scenario())


def test_gemini_auth_not_retried(monkeypatch, transport):
    monkeypatch.setenv("GEMINI_API_KEY","test-placeholder-not-real")
    db=Database(":memory:")
    db.execute("INSERT INTO provider_models VALUES (?,?,?,?,?,?,?)", ("fast","gemini","example-flash","Example Flash","fast","verified",0.0))
    p=Provider(db)
    install,calls=transport
    install(lambda request:httpx.Response(403,json={"error":"refused"}))
    async def scenario():
        with pytest.raises(ProviderError) as e:
            await p.complete([{"role":"user","content":"hi"}],[],"fast",100)
        assert e.value.code=="provider_auth"
    asyncio.run(scenario())
    assert len(calls)==1


def test_aiseek_sse_and_strict_tool_protocol(monkeypatch, transport):
    monkeypatch.setenv("AISEEK_ACCESS_TOKEN","test-placeholder-not-real")
    db=Database(":memory:")
    db.execute("INSERT INTO provider_models VALUES (?,?,?,?,?,?,?)", ("fast","aiseek","deepseek/deepseek-chat","DeepSeek","fast","verified",0.0))
    p=Provider(db)
    install,calls=transport
    text=json.dumps({"type":"tool_calls","calls":[{"name":"calculate","arguments":{"expression":"6*7"}}]})
    install(lambda request:httpx.Response(200,headers={"content-type":"text/event-stream"},
        text="data: "+json.dumps({"content":"<think>hidden</think>"+text})+"\n\ndata: [DONE]\n\n"))
    async def scenario():
        m,spent=await p.complete([{"role":"user","content":"6*7"}],[{"type":"function","function":{"name":"calculate","parameters":{}}}],"fast",1000)
        assert m["tool_calls"][0]["function"]["name"]=="calculate"
        sent=json.loads(calls[0].content)
        assert sent["sessionId"]!=sent["userMessageId"]
        assert calls[0].headers["x-access-token"]=="test-placeholder-not-real"
        assert "x-device-info" not in calls[0].headers
    asyncio.run(scenario())


def test_aiseek_never_executes_unstructured_prose(monkeypatch, transport):
    monkeypatch.setenv("AISEEK_ACCESS_TOKEN","test-placeholder-not-real")
    db=Database(":memory:")
    db.execute("INSERT INTO provider_models VALUES (?,?,?,?,?,?,?)", ("fast","aiseek","deepseek/deepseek-chat","DeepSeek","fast","verified",0.0))
    p=Provider(db)
    install,calls=transport
    install(lambda request:httpx.Response(200,text='data: {"content":"I ran shell and deployed everything"}\n\n'))
    async def scenario():
        with pytest.raises(ProviderError) as e:
            await p.complete([{"role":"user","content":"deploy"}],[{"type":"function","function":{"name":"calculate","parameters":{}}}],"fast",1000)
        assert e.value.code=="aiseek_protocol"
    asyncio.run(scenario())


def test_unverified_models_are_not_exposed(monkeypatch):
    monkeypatch.setenv("AISEEK_ACCESS_TOKEN","test-placeholder-not-real")
    p=Provider(Database(":memory:"))
    assert p.models() == []


def test_openai_transient_retry_is_bounded(monkeypatch,transport):
    monkeypatch.setenv("OPENAI_API_KEY","test-placeholder-not-real")
    monkeypatch.setenv("FAST_MODEL","fixture-model")
    db=Database(":memory:")
    db.execute("INSERT INTO provider_models VALUES (?,?,?,?,?,?,?)", ("fast","openai","fixture-model","fixture-model","fast","verified",0.0))
    p=Provider(db)
    install,calls=transport
    install(lambda request:httpx.Response(503,json={"error":"temporary"}))
    async def no_delay(*args):pass
    monkeypatch.setattr(asyncio,"sleep",no_delay)
    async def scenario():
        with pytest.raises(ProviderError) as e:
            await p.complete([{"role":"user","content":"hello"}],[],"fast",100)
        assert e.value.retryable
    asyncio.run(scenario())
    assert len(calls)==3


def test_model_resolution_requires_verified_catalog(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-placeholder-not-real")
    monkeypatch.setenv("AISEEK_ACCESS_TOKEN", "test-placeholder-not-real")
    provider = Provider(Database(":memory:"))
    assert provider.models() == []
    assert provider.tier("fast") == "fast"
