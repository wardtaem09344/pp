import asyncio
import contextlib
import base64
import io
import json
import os
import re
import secrets
import time
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

from .auth import (COOKIE, create_session, current_user, owner, password_hash,
                   password_matches, public_user, token_digest)
from .db import Database, uid
from .engine import Engine
from .plans import PLANS, entitlement, reserve, usage
from .provider import Provider, configured_models
from .strategy import route
from .tools import ToolError, ToolRegistry, safe_path


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Credentials(Strict):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)
    name: str = Field(default="", max_length=80)


class ChatInput(Strict):
    chat_id: str | None = None
    message: str = Field(default="", max_length=80000)
    mode: str = "chat"
    model: str = "fast"
    images: list[str] = Field(default_factory=list, max_length=4)
    think: bool = False
    regenerate: bool = False
    edit_message_id: str | None = None


class ChatPatch(Strict):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    pinned: int | None = Field(default=None, ge=0, le=1)
    archived: int | None = Field(default=None, ge=0, le=1)


class UserPatch(Strict):
    plan: str | None = None
    role: str | None = None


class MemoryInput(Strict):
    scope: str = "preference"
    project: str = Field(default="", max_length=64)
    text: str = Field(min_length=1, max_length=2000)
    consent: bool = False


class PasswordInput(Strict):
    current: str = Field(max_length=128)
    next: str = Field(min_length=10, max_length=128)


TERMINAL = {"completed", "completed_unverified", "failed", "blocked", "cancelled", "interrupted", "limit_reached"}


def create_app(database=None, provider=None):
    db = database or Database()
    provider = provider or Provider(db)
    engine = Engine(db, provider)

    @asynccontextmanager
    async def lifespan(app):
        # Single-worker long-lived deployment recovers verified persisted state.
        # Serverless requests complete their own work and do not use background launch.
        if not os.getenv("VERCEL"):
            db.execute("UPDATE runs SET status='interrupted' WHERE status IN ('queued','running')")
        yield
        for task in list(engine.tasks.values()):
            task.cancel()
        if engine.tasks:
            await asyncio.gather(*list(engine.tasks.values()), return_exceptions=True)

    app = FastAPI(title="APEX Agent", version="1.0.0", lifespan=lifespan,
                  docs_url=None if os.getenv("ENVIRONMENT") == "production" else "/docs")
    app.state.db, app.state.engine, app.state.provider = db, engine, provider
    origins = [x for x in os.getenv("ALLOWED_ORIGINS", "http://127.0.0.1:3000,http://localhost:3000").split(",") if x]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True,
                       allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
                       allow_headers=["Authorization", "Content-Type", "X-Visitor-Id"])

    @app.middleware("http")
    async def protections(request, call_next):
        try:
            content_length = int(request.headers.get("content-length", "0") or "0")
        except ValueError:
            return JSONResponse({"detail": "invalid_content_length"}, status_code=400)
        if content_length > 500000:
            return JSONResponse({"detail": "request_too_large"}, status_code=413)
        # Never deploy multi-user sessions to disposable serverless SQLite.
        if os.getenv("VERCEL") and not db.pg and request.url.path.startswith("/api/") and request.url.path != "/api/health":
            return JSONResponse({"detail": {"code": "database_required",
                "message": "يلزم ربط PostgreSQL دائم لتفعيل الحسابات والوكيل على هذه الاستضافة."}}, status_code=503)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(ToolError)
    async def tool_error(request, exc):
        return JSONResponse({"detail": str(exc)}, status_code=400)

    def owned_chat(chat_id, user):
        row = db.one("SELECT * FROM chats WHERE id=? AND user_id=?", (chat_id, user["id"]))
        if not row:
            raise HTTPException(404, "chat_not_found")
        return row

    def chat_data(chat_id):
        result = db.one("SELECT * FROM chats WHERE id=?", (chat_id,))
        result["messages"] = []
        for row in db.all("SELECT * FROM messages WHERE chat_id=? ORDER BY created", (chat_id,)):
            row["meta"], row["images"] = json.loads(row["meta"]), json.loads(row["images"])
            result["messages"].append(row)
        return result

    def owned_run(run_id, user):
        row = db.one("SELECT * FROM runs WHERE id=? AND user_id=?", (run_id, user["id"]))
        if not row:
            raise HTTPException(404, "run_not_found")
        return row

    @app.get("/api/health")
    def health():
        return {"status": "ok", "version": "apex-1.0.0", "provider_ready": provider.ready,
                "storage": "postgresql" if db.pg else "sqlite-development",
                "configuration_complete": bool(provider.ready and db.pg),
                "provider_live_verification": "not-inferred-from-config"}

    def auth_rate_limit(email, request):
        # Persistent, bounded login-attempt counter keyed by address+email digest.
        import hashlib
        address = request.client.host if request.client else "unknown"
        key = hashlib.sha256((address + ":" + email.lower()).encode()).hexdigest()
        attempts = db.one("SELECT COUNT(*) AS n FROM audit WHERE user_id=? AND action='auth_attempt' AND created>?",
                          ("auth:" + key, time.time() - 600))["n"]
        if attempts >= 15:
            raise HTTPException(429, "too_many_auth_attempts")
        db.audit("auth:" + key, "auth_attempt")

    @app.post("/api/auth/signup")
    def signup(body: Credentials, request: Request, response: Response):
        auth_rate_limit(body.email, request)
        email = body.email.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) or len(body.password) < 10:
            return JSONResponse({"error": "invalid"}, status_code=400)
        with db.transaction():
            if db.one("SELECT id FROM users WHERE email=?", (email,)):
                return JSONResponse({"error": "exists"}, status_code=409)
            user_id = uid()
            db.execute("INSERT INTO users(id,email,name,password,role,plan,created,prefs) VALUES(?,?,?,?,?,?,?,?)",
                (user_id, email, body.name.strip() or email.split("@")[0],
                 password_hash(body.password), "user", "free", time.time(), "{}"))
        token = create_session(db, user_id, response)
        user = db.one("SELECT * FROM users WHERE id=?", (user_id,))
        return {"token": token, "user": public_user(user)}

    @app.post("/api/auth/login")
    def login(body: Credentials, request: Request, response: Response):
        auth_rate_limit(body.email, request)
        user = db.one("SELECT * FROM users WHERE email=?", (body.email.strip().lower(),))
        # Constant-work fallback prevents easy timing-based account enumeration.
        encoded = user["password"] if user else "fallback:0" + "0" * 127
        if not password_matches(body.password, encoded) or not user:
            return JSONResponse({"error": "bad"}, status_code=401)
        token = create_session(db, user["id"], response)
        return {"token": token, "user": public_user(user)}

    @app.get("/api/auth/me")
    def me(request: Request):
        return {"user": public_user(current_user(request))}

    @app.post("/api/auth/logout")
    def logout(request: Request, response: Response):
        user = current_user(request)
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get(COOKIE, "")
        db.execute("DELETE FROM sessions WHERE digest=?", (token_digest(token),))
        response.delete_cookie(COOKIE, secure=True, httponly=True, path="/")
        return {"ok": True}

    @app.post("/api/auth/password")
    def change_password(body: PasswordInput, request: Request):
        user = current_user(request)
        if not password_matches(body.current, user["password"]):
            raise HTTPException(400, "wrong_password")
        with db.transaction(user["id"]):
            db.execute("UPDATE users SET password=? WHERE id=?", (password_hash(body.next), user["id"]))
            db.execute("DELETE FROM sessions WHERE user_id=?", (user["id"],))
        return {"ok": True, "reauthenticate": True}

    @app.get("/api/prefs")
    def get_prefs(request: Request):
        return json.loads(current_user(request)["prefs"])

    @app.put("/api/prefs")
    async def put_prefs(request: Request):
        user = current_user(request)
        body = await request.json()
        allowed = {"lang", "theme", "model", "mode", "collapsed", "memory_opt_in"}
        prefs = json.loads(user["prefs"])
        for key in allowed & body.keys():
            value = body[key]
            if key == "memory_opt_in" and type(value) is not bool:
                raise HTTPException(400, "memory_opt_in_must_be_boolean")
            if not isinstance(value, (str, bool)) or len(str(value)) > 100:
                raise HTTPException(400, "invalid_preference")
            prefs[key] = value
        db.execute("UPDATE users SET prefs=? WHERE id=?", (json.dumps(prefs), user["id"]))
        return prefs

    @app.get("/api/plans")
    def plans(request: Request):
        user = current_user(request)
        return {"plans": PLANS, "current": user["plan"], "usage": usage(db, user),
                "reset": "00:00 UTC", "billing": "Owner-managed plans; no payment processor connected."}

    @app.get("/api/capabilities")
    def capabilities(request: Request):
        user = current_user(request)
        plan = entitlement(user)
        return {"provider_ready": provider.ready, "plan": user["plan"],
                "models": [{**m, "allowed": m.get("tier", m["id"]) in plan["models"]} for m in provider.models()],
                "tools": ToolRegistry(db, user, "").inventory(),
                "features": {"image_generation": False, "vision": False, "shell": False, "browser": False,
                             "parallel_agents": False, "memory": plan["memory"], "resume": plan["resume"]},
                "limits": plan, "storage": "postgresql" if db.pg else "sqlite-development"}

    @app.get("/api/chats")
    def chats(request: Request, q: str = ""):
        user = current_user(request)
        return db.all("""SELECT * FROM chats WHERE user_id=? AND archived=0 AND LOWER(title) LIKE ?
                       ORDER BY pinned DESC,updated DESC""", (user["id"], "%" + q[:200].lower() + "%"))

    @app.get("/api/chats/{chat_id}")
    def get_chat(chat_id: str, request: Request):
        user = current_user(request)
        owned_chat(chat_id, user)
        return chat_data(chat_id)

    @app.patch("/api/chats/{chat_id}")
    def patch_chat(chat_id: str, body: ChatPatch, request: Request):
        user = current_user(request)
        owned_chat(chat_id, user)
        for key, value in body.model_dump(exclude_none=True).items():
            db.execute(f"UPDATE chats SET {key}=? WHERE id=? AND user_id=?", (value, chat_id, user["id"]))
        return {"ok": True}

    def delete_chat_data(chat_id, user_id):
        for run in db.all("SELECT id FROM runs WHERE chat_id=?", (chat_id,)):
            task = engine.tasks.get(run["id"])
            if task:
                task.cancel()
            db.execute("UPDATE runs SET status='cancelled' WHERE id=?", (run["id"],))
        db.execute("DELETE FROM messages WHERE chat_id=?", (chat_id,))
        db.execute("DELETE FROM files WHERE user_id=? AND chat_id=?", (user_id, chat_id))
        db.execute("DELETE FROM chats WHERE id=? AND user_id=?", (chat_id, user_id))

    @app.delete("/api/chats/{chat_id}")
    def delete_chat(chat_id: str, request: Request):
        user = current_user(request)
        owned_chat(chat_id, user)
        delete_chat_data(chat_id, user["id"])
        return {"ok": True}

    @app.delete("/api/chats")
    def delete_all_chats(request: Request):
        user = current_user(request)
        for row in db.all("SELECT id FROM chats WHERE user_id=?", (user["id"],)):
            delete_chat_data(row["id"], user["id"])
        return {"ok": True}

    async def event_stream(run_id, request, initial=None, inline=False):
        if initial:
            yield "event: meta\ndata: " + json.dumps(initial) + "\n\n"
        # Vercel must keep execution within the live request; no unawaited
        # process-local background workers that vanish on request completion.
        if inline:
            row = db.one("SELECT user_id FROM runs WHERE id=?", (run_id,))
            user = db.one("SELECT * FROM users WHERE id=?", (row["user_id"],))
            task = engine.launch(run_id, user)
        seen = set()
        while True:
            rows = db.all("SELECT * FROM events WHERE run_id=? ORDER BY created,id", (run_id,))
            for row in rows:
                if row["id"] in seen:
                    continue
                seen.add(row["id"])
                yield "id: " + row["id"] + "\nevent: " + row["kind"] + "\ndata: " + row["payload"] + "\n\n"
            run = db.one("SELECT status FROM runs WHERE id=?", (run_id,))
            if not run or run["status"] in TERMINAL:
                # Yielding an earlier batch lets the worker finish while the
                # response is being sent. Drain its newly persisted final events
                # before closing; otherwise evaluation/done can be lost.
                final_rows = db.all("SELECT * FROM events WHERE run_id=? ORDER BY created,id", (run_id,))
                for row in final_rows:
                    if row["id"] not in seen:
                        seen.add(row["id"])
                        yield "id: " + row["id"] + "\nevent: " + row["kind"] + "\ndata: " + row["payload"] + "\n\n"
                break
            if await request.is_disconnected():
                # Explicit checkpoint remains; do not claim a disconnected
                # serverless request continues executing forever.
                if inline:
                    task.cancel()
                    db.execute("UPDATE runs SET status='interrupted' WHERE id=? AND status='running'", (run_id,))
                break
            yield ": heartbeat\n\n"
            await asyncio.sleep(0.15)

    @app.post("/api/chat")
    async def chat(body: ChatInput, request: Request):
        user = current_user(request)
        if body.mode not in ("chat", "agent", "search", "research", "image"):
            raise HTTPException(400, "invalid_mode")
        if body.mode == "image" or body.images:
            raise HTTPException(422, {"code": "unsupported_media", "message": "توليد الصور وتحليل المرفقات غير موصولين بمزوّد فعلي بعد."})
        plan = entitlement(user)
        if provider.tier(body.model) not in plan["models"]:
            raise HTTPException(403, {"code": "model_plan_required"})
        if body.mode == "agent" and not plan["agent"]:
            raise HTTPException(403, {"code": "plan_required", "message": "وضع الوكيل متاح من خطة Plus."})
        if body.mode == "research" and not plan["research"]:
            raise HTTPException(403, {"code": "plan_required"})
        registry = ToolRegistry(db, user, body.chat_id or "")
        if body.mode in ("search", "research") and not ({"search_web", "fetch_page"} & set(registry.available())):
            raise HTTPException(403, {"code": "research_not_available", "message": "البحث الخارجي يحتاج خطة Pro أو Ultra وأداة استرجاع موصولة."})
        if not provider.ready:
            raise HTTPException(503, {"code": "provider_not_configured",
                "message": "ملفات المستودع تحتوي أسماء النماذج فقط. يلزم ملف الخادم الأصلي أو إعداد مزوّد فعلي لتشغيل الذكاء الاصطناعي."})
        if body.model not in [m["id"] for m in provider.models()]:
            raise HTTPException(422, {"code": "model_not_configured"})
        is_new = not body.chat_id
        chat_id = body.chat_id or uid()
        history = []
        objective = body.message.strip()
        if not is_new:
            owned_chat(chat_id, user)
            old = db.all("SELECT * FROM messages WHERE chat_id=? ORDER BY created", (chat_id,))
            if body.regenerate:
                last_user = next((m for m in reversed(old) if m["role"] == "user"), None)
                if not last_user:
                    raise HTTPException(400, "nothing_to_regenerate")
                objective = last_user["content"]
            history = [{"role": m["role"], "content": m["content"][:4000]} for m in old[-10:]]
        if not objective:
            raise HTTPException(400, "message_required")
        if len(objective) + len(json.dumps(history)) + 4000 > plan["context"]:
            raise HTTPException(413, {"code": "context_limit"})
        decision = route(objective, registry.available(), body.mode)
        run_id, user_msg_id, assistant_id = uid(), uid(), uid()
        checkpoint = {"mode": body.mode, "model": body.model, "assistant_id": assistant_id,
                      "history": history}
        with db.transaction(user["id"]):
            reserve(db, user, body.mode)
            if is_new:
                db.execute("INSERT INTO chats(id,user_id,title,updated) VALUES(?,?,?,?)",
                           (chat_id, user["id"], objective[:80], time.time()))
            if body.edit_message_id:
                target = db.one("SELECT * FROM messages WHERE id=? AND chat_id=? AND role='user'",
                                (body.edit_message_id, chat_id))
                if not target:
                    raise HTTPException(404, "message_not_found")
                db.execute("DELETE FROM messages WHERE chat_id=? AND created>=?", (chat_id, target["created"]))
                checkpoint["history"] = [{"role": m["role"], "content": m["content"][:4000]} for m in old if m["created"] < target["created"]][-10:]
            elif body.regenerate:
                db.execute("DELETE FROM messages WHERE chat_id=? AND role='assistant' AND created>?", (chat_id, last_user["created"]))
                checkpoint["history"] = [{"role": m["role"], "content": m["content"][:4000]} for m in old if m["created"] < last_user["created"]][-10:]
                user_msg_id = last_user["id"]
            if not body.regenerate:
                db.execute("INSERT INTO messages VALUES (?,?,?,?,?,?,?)",
                           (user_msg_id, chat_id, "user", objective, "[]", "{}", time.time()))
            db.execute("UPDATE chats SET updated=? WHERE id=?", (time.time(), chat_id))
            db.execute("INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?)",
                       (run_id, user["id"], chat_id, "queued", objective, json.dumps(decision),
                        json.dumps(checkpoint), time.time(), time.time(), ""))
        if not os.getenv("VERCEL"):
            engine.launch(run_id, user)
        meta = {"chat_id": chat_id, "run_id": run_id, "new": is_new,
                "user_msg_id": user_msg_id, "assistant_msg_id": assistant_id}
        return StreamingResponse(event_stream(run_id, request, meta, inline=bool(os.getenv("VERCEL"))),
            media_type="text/event-stream", headers={"X-Accel-Buffering": "no", "Cache-Control": "no-store"})

    @app.get("/api/runs")
    def runs(request: Request, chat_id: str = ""):
        user = current_user(request)
        if chat_id:
            owned_chat(chat_id, user)
        rows = db.all("""SELECT id,chat_id,status,objective,strategy,created,updated,error FROM runs
                         WHERE user_id=? ORDER BY created DESC LIMIT 50""", (user["id"],))
        return [r for r in rows if not chat_id or r["chat_id"] == chat_id]

    @app.get("/api/runs/{run_id}")
    def get_run(run_id: str, request: Request):
        row = owned_run(run_id, current_user(request))
        row.pop("checkpoint")
        row["strategy"] = json.loads(row["strategy"])
        row["events"] = [{**r, "payload": json.loads(r["payload"])} for r in db.all(
            "SELECT id,kind,payload,created FROM events WHERE run_id=? ORDER BY created,id", (run_id,))]
        row["task_graph"] = db.all("SELECT * FROM task_nodes WHERE run_id=? ORDER BY updated", (run_id,))
        return row

    @app.post("/api/runs/{run_id}/cancel")
    def cancel(run_id: str, request: Request):
        user = current_user(request)
        row = owned_run(run_id, user)
        owned_chat(row["chat_id"], user)
        if row["status"] in TERMINAL:
            return {"status": row["status"]}
        db.execute("UPDATE runs SET status='cancelled',updated=? WHERE id=?", (time.time(), run_id))
        task = engine.tasks.get(run_id)
        if task:
            task.cancel()
        db.audit(user["id"], "cancel_run", run_id)
        return {"status": "cancelled"}

    @app.post("/api/runs/{run_id}/resume")
    async def resume(run_id: str, request: Request):
        user = current_user(request)
        row = owned_run(run_id, user)
        owned_chat(row["chat_id"], user)
        plan = entitlement(user)
        if not plan["resume"]:
            raise HTTPException(403, "resume_requires_pro")
        if row["status"] not in ("interrupted", "failed"):
            raise HTTPException(409, "run_not_resumable")
        checkpoint = json.loads(row["checkpoint"])
        if checkpoint.get("steps", 0) >= plan["steps"]:
            raise HTTPException(409, "step_limit_reached")
        # Pending tool batch replay is explicit and idempotency-protected.
        messages = checkpoint.get("messages", [])
        if messages and messages[-1]["role"] == "assistant" and messages[-1].get("tool_calls"):
            raise HTTPException(409, "pending_tool_outcome_requires_manual_review")
        with db.transaction(user["id"]):
            reserve(db, user, checkpoint["mode"])
            db.execute("UPDATE runs SET status='queued',error='',updated=? WHERE id=?", (time.time(), run_id))
        if not os.getenv("VERCEL"):
            engine.launch(run_id, user)
        db.audit(user["id"], "resume_run", run_id)
        return StreamingResponse(event_stream(run_id, request, inline=bool(os.getenv("VERCEL"))),
                                 media_type="text/event-stream")

    @app.get("/api/agent/{chat_id}/file")
    def download_file(chat_id: str, path: str, request: Request):
        user = current_user(request)
        owned_chat(chat_id, user)
        row = ToolRegistry(db, user, chat_id).file(path)
        body, media = row["content"], "text/plain; charset=utf-8"
        if body.startswith("data:image/") and ";base64," in body:
            head, b64 = body.split(";base64,", 1)
            body, media = base64.b64decode(b64), head[5:]
        return Response(body, media_type=media,
                        headers={"Content-Disposition": "attachment; filename*=UTF-8''" + __import__("urllib.parse", fromlist=["quote"]).quote(path.rsplit("/", 1)[-1])})

    @app.get("/api/agent/{chat_id}/zip")
    def download_zip(chat_id: str, request: Request):
        user = current_user(request)
        owned_chat(chat_id, user)
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            for row in db.all("SELECT path,content FROM files WHERE user_id=? AND chat_id=?", (user["id"], chat_id)):
                data = row["content"]
                if data.startswith("data:image/") and ";base64," in data:
                    data = base64.b64decode(data.split(";base64,", 1)[1])
                archive.writestr(safe_path(row["path"]), data)
        return Response(buffer.getvalue(), media_type="application/zip",
                        headers={"Content-Disposition": 'attachment; filename="agent-files.zip"'})

    @app.get("/api/memory")
    def memories(request: Request):
        user = current_user(request)
        if not entitlement(user)["memory"]:
            raise HTTPException(403, "memory_requires_pro")
        return db.all("SELECT * FROM memories WHERE user_id=? ORDER BY created DESC LIMIT 200", (user["id"],))

    @app.post("/api/memory")
    def add_memory(body: MemoryInput, request: Request):
        user = current_user(request)
        if not entitlement(user)["memory"]:
            raise HTTPException(403, "memory_requires_pro")
        if not body.consent or body.scope not in ("preference", "project"):
            raise HTTPException(400, "explicit_consent_and_supported_scope_required")
        if body.project:
            owned_chat(body.project, user)
        count = db.one("SELECT COUNT(*) AS n FROM memories WHERE user_id=?", (user["id"],))["n"]
        if count >= 200:
            raise HTTPException(429, "memory_limit")
        memory_id = uid()
        db.execute("INSERT INTO memories VALUES (?,?,?,?,?,?,?,?,?)",
            (memory_id, user["id"], body.scope, body.project, body.text, "explicit-user-input", 1.0, 1, time.time()))
        db.audit(user["id"], "memory_consent", memory_id)
        return {"id": memory_id}

    @app.delete("/api/memory/{memory_id}")
    def remove_memory(memory_id: str, request: Request):
        user = current_user(request)
        db.execute("DELETE FROM memories WHERE id=? AND user_id=?", (memory_id, user["id"]))
        return {"ok": True}

    @app.get("/api/admin/users")
    def users(request: Request):
        owner(request)
        rows = db.all("""SELECT u.*, (SELECT COUNT(*) FROM chats c WHERE c.user_id=u.id) AS chats
                         FROM users u ORDER BY created DESC""")
        return [{**public_user(u), "chats": u["chats"]} for u in rows]

    @app.patch("/api/admin/users/{user_id}")
    def update_user(user_id: str, body: UserPatch, request: Request):
        admin = owner(request)
        target = db.one("SELECT * FROM users WHERE id=?", (user_id,))
        if not target:
            raise HTTPException(404, "user_not_found")
        if body.plan is not None and body.plan not in PLANS:
            raise HTTPException(400, "invalid_plan")
        if body.role is not None and body.role not in ("owner", "user"):
            raise HTTPException(400, "invalid_role")
        if body.role == "user" and target["role"] == "owner":
            if db.one("SELECT COUNT(*) AS n FROM users WHERE role='owner'")["n"] <= 1:
                raise HTTPException(409, "last_owner_protected")
        for key, value in body.model_dump(exclude_none=True).items():
            db.execute(f"UPDATE users SET {key}=? WHERE id=?", (value, user_id))
        db.audit(admin["id"], "update_user", json.dumps({"target": user_id, **body.model_dump(exclude_none=True)}))
        return {"user": public_user(db.one("SELECT * FROM users WHERE id=?", (user_id,)))}

    @app.post("/api/admin/users/{user_id}/reset")
    def reset_user(user_id: str, request: Request):
        admin = owner(request)
        if not db.one("SELECT id FROM users WHERE id=?", (user_id,)):
            raise HTTPException(404, "user_not_found")
        password = secrets.token_urlsafe(18)
        db.execute("UPDATE users SET password=? WHERE id=?", (password_hash(password), user_id))
        db.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
        db.audit(admin["id"], "reset_password", user_id)
        return {"password": password}

    @app.delete("/api/admin/users/{user_id}")
    def remove_user(user_id: str, request: Request):
        admin = owner(request)
        if admin["id"] == user_id:
            raise HTTPException(409, "cannot_delete_self")
        for c in db.all("SELECT id FROM chats WHERE user_id=?", (user_id,)):
            delete_chat_data(c["id"], user_id)
        for table in ("sessions", "memories", "usage"):
            db.execute(f"DELETE FROM {table} WHERE user_id=?", (user_id,))
        db.execute("DELETE FROM users WHERE id=?", (user_id,))
        db.audit(admin["id"], "delete_user", user_id)
        return {"ok": True}

    @app.get("/api/admin/stats")
    def stats(request: Request):
        owner(request)
        result = {table: db.one(f"SELECT COUNT(*) AS n FROM {table}")["n"]
                  for table in ("users", "chats", "messages")}
        result.update(images=0, searches=0, research=0, agent=db.one("SELECT COUNT(*) AS n FROM runs")["n"])
        result["recent"] = [public_user(u) for u in db.all("SELECT * FROM users ORDER BY created DESC LIMIT 8")]
        return result

    @app.get("/api/admin/chats")
    def admin_chats(request: Request):
        owner(request)
        return db.all("""SELECT c.*,u.email,(SELECT COUNT(*) FROM messages m WHERE m.chat_id=c.id) AS msgs
                         FROM chats c JOIN users u ON u.id=c.user_id ORDER BY updated DESC LIMIT 100""")

    @app.get("/api/admin/chats/{chat_id}/full")
    def admin_chat(chat_id: str, request: Request):
        admin = owner(request)
        if not db.one("SELECT id FROM chats WHERE id=?", (chat_id,)):
            raise HTTPException(404, "chat_not_found")
        db.audit(admin["id"], "admin_view_chat", chat_id)
        return chat_data(chat_id)

    @app.delete("/api/admin/chats/{chat_id}")
    def admin_delete_chat(chat_id: str, request: Request):
        admin = owner(request)
        row = db.one("SELECT user_id FROM chats WHERE id=?", (chat_id,))
        if row:
            delete_chat_data(chat_id, row["user_id"])
        db.audit(admin["id"], "admin_delete_chat", chat_id)
        return {"ok": True}

    @app.get("/api/admin/settings")
    def settings(request: Request):
        owner(request)
        return {"providerReady": provider.ready, "models": provider.models(),
                "geminiKeySet": bool(os.getenv("GEMINI_API_KEY")),
                "aiSeekSet": False, "systemPrompt": "Versioned server profiles; managed in source, not arbitrary prompt overwrites.",
                "configuration": "Set model credentials and endpoints in hosting environment variables; never in browser fields."}

    @app.put("/api/admin/settings")
    def settings_write(request: Request):
        owner(request)
        raise HTTPException(422, "Use hosting environment variables for credentials and version-controlled profiles for system behavior")

    @app.post("/api/admin/models/refresh")
    async def refresh_models(request: Request):
        admin = owner(request)
        result = await provider.discover()
        db.audit(admin["id"], "model_discovery", str(len(result["discovered"])))
        return result

    app.mount("/", StaticFiles(directory=Path(__file__).resolve().parent.parent / "app", html=True), name="static")
    return app


app = create_app()
