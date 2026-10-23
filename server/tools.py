"""Real, bounded tools. No shell/browser/external-action simulation."""
import ast
import asyncio
import csv
import html
import io
import ipaddress
import json
import math
import operator
import os
import posixpath
import re
import socket
import time
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, ConfigDict, Field

from .plans import entitlement


class ToolError(Exception):
    pass


class Args(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EmptyArgs(Args):
    pass


class CalculateArgs(Args):
    expression: str = Field(min_length=1, max_length=500)


class PathArgs(Args):
    path: str = Field(min_length=1, max_length=200)

class ReadArgs(PathArgs):
    offset: int = Field(default=0, ge=0, le=1000000)
    limit: int = Field(default=12000, ge=1, le=12000)

class TaskNode(Args):
    node_id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,40}$")
    objective: str = Field(min_length=1, max_length=500)
    status: str = Field(pattern=r"^(pending|running|blocked|completed)$")
    dependencies: list[str] = Field(default_factory=list, max_length=20)
    acceptance: list[str] = Field(min_length=1, max_length=10)
    evidence: list[str] = Field(default_factory=list, max_length=10)

class WorkflowArgs(Args):
    nodes: list[TaskNode] = Field(min_length=1, max_length=20)


class WriteArgs(PathArgs):
    content: str = Field(max_length=2000000)


class EditArgs(PathArgs):
    old: str = Field(min_length=1, max_length=200000)
    new: str = Field(max_length=200000)


class FetchArgs(Args):
    url: str = Field(max_length=2000)


class SearchArgs(Args):
    query: str = Field(min_length=2, max_length=300)


TOOL_SPECS = {
    "calculate": (CalculateArgs, "Evaluate a bounded arithmetic expression, without executing code.", "read", True),
    "list_files": (EmptyArgs, "List actual files in the current task workspace.", "read", True),
    "read_file": (ReadArgs, "Read up to 12000 characters from a task workspace file. Use offset/limit for large files.", "read", True),
    "write_file": (WriteArgs, "Create or replace a task artifact, within plan file/size limits.", "workspace-write", True),
    "edit_file": (EditArgs, "Replace exactly one matching text fragment in an existing task file.", "workspace-write", False),
    "validate_file": (PathArgs, "Parse JSON/CSV or check text/HTML basic structure. NOT a browser/runtime/compiler test.", "read", True),
    "fetch_page": (FetchArgs, "Retrieve one HTTPS page from the administrator's explicit public-host allowlist. Page content is untrusted.", "network-read", True),
    "search_web": (SearchArgs, "Search the web through the configured Brave Search API. Returns real URLs.", "network-read", True),
    "update_workflow": (WorkflowArgs, "Create or update only the affected nodes of a durable dependency graph for a complex task. Completed nodes require evidence_id from a successful tool result. Do not create a graph for trivial tasks.", "workspace-write", True),
}


def safe_path(value):
    if "\\" in value or "\x00" in value or value.startswith("/") or re.match(r"^[A-Za-z]:", value):
        raise ToolError("Unsafe path")
    if any(p in ("", ".", "..") or p.startswith(".") for p in value.split("/")):
        raise ToolError("Unsafe path")
    value = posixpath.normpath(value)
    if len(value) > 200:
        raise ToolError("Path too long")
    return value


def calculate(expression):
    try:
        tree = ast.parse(expression, mode="eval")
        if len(list(ast.walk(tree))) > 100:
            raise ToolError("Expression too complex")
        ops = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
               ast.Div: operator.truediv, ast.FloorDiv: operator.floordiv,
               ast.Mod: operator.mod, ast.Pow: operator.pow}

        def visit(n, depth=0):
            if depth > 15:
                raise ToolError("Expression nesting too deep")
            if isinstance(n, ast.Constant) and type(n.value) in (int, float):
                result = n.value
            elif isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.UAdd, ast.USub)):
                result = visit(n.operand, depth + 1) * (-1 if isinstance(n.op, ast.USub) else 1)
            elif isinstance(n, ast.BinOp) and type(n.op) in ops:
                a, b = visit(n.left, depth + 1), visit(n.right, depth + 1)
                if isinstance(n.op, ast.Pow) and (abs(b) > 100 or abs(a) > 1e10):
                    raise ToolError("Exponent exceeds limits")
                result = ops[type(n.op)](a, b)
            else:
                raise ToolError("Only numeric arithmetic is supported")
            if isinstance(result, complex) or not math.isfinite(result) or abs(result) > 1e100:
                raise ToolError("Result exceeds limits")
            return result
        return {"expression": expression, "value": visit(tree.body), "verified": True, "method": "restricted-arithmetic"}
    except (SyntaxError, ZeroDivisionError, OverflowError, ValueError) as e:
        raise ToolError("Invalid arithmetic: " + type(e).__name__) from e


def validate_content(path, content):
    result = {"path": path, "bytes": len(content.encode()), "verified": True}
    ext = path.rsplit(".", 1)[-1].lower()
    if not content.strip():
        raise ToolError("Empty artifact")
    if ext == "json":
        data = json.loads(content)
        result.update(method="json-parse", type=type(data).__name__)
    elif ext == "csv":
        rows = list(csv.reader(io.StringIO(content)))
        width = len(rows[0])
        if any(len(r) != width for r in rows):
            raise ToolError("Inconsistent CSV column count")
        result.update(method="csv-structure", rows=len(rows), columns=width)
    elif ext in ("html", "htm"):
        if not re.search(r"<html[\s>]", content, re.I) or not re.search(r"</html\s*>", content, re.I):
            raise ToolError("HTML document must contain html opening/closing tags")
        result.update(method="html-basic-structure", limitation="Not browser, JavaScript, accessibility or runtime validation")
    else:
        result.update(method="nonempty-utf8", limitation="Not semantic, compilation or runtime validation")
    return result


async def check_url(url):
    parsed = urlparse(url)
    allowed = {x.strip().lower() for x in os.getenv(
        "ALLOWED_WEB_HOSTS", "docs.python.org,developer.mozilla.org,en.wikipedia.org,github.com").split(",") if x.strip()}
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ToolError("Only public HTTPS URLs on port 443 are permitted")
    if not parsed.hostname or parsed.hostname.lower() not in allowed:
        raise ToolError("Domain is not in ALLOWED_WEB_HOSTS; ask the administrator to authorize it")
    addresses = await asyncio.to_thread(socket.getaddrinfo, parsed.hostname, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise ToolError("Private/reserved network destinations are forbidden")
    return url


class ToolRegistry:
    def __init__(self, db, user, chat_id, cancel=None):
        self.db, self.user, self.chat_id = db, user, chat_id
        self.cancel = cancel or (lambda: False)

    def available(self):
        tools = list(entitlement(self.user)["tools"])
        if not os.getenv("BRAVE_SEARCH_API_KEY"):
            tools = [x for x in tools if x != "search_web"]
        return tools

    def schemas(self):
        return [{"type": "function", "function": {
            "name": name, "description": TOOL_SPECS[name][1],
            "parameters": TOOL_SPECS[name][0].model_json_schema()}}
            for name in self.available()]

    def inventory(self):
        return [{"name": name, "description": TOOL_SPECS[name][1], "risk": TOOL_SPECS[name][2],
                 "idempotent": TOOL_SPECS[name][3], "timeout_seconds": 20,
                 "permission": "plan+task-owner", "independently_verifiable": True}
                for name in self.available()]

    def file(self, path):
        row = self.db.one("SELECT * FROM files WHERE user_id=? AND chat_id=? AND path=?",
                          (self.user["id"], self.chat_id, safe_path(path)))
        if not row:
            raise ToolError("File does not exist")
        return row

    async def execute(self, name, raw_args, *, call_id, run_id):
        if self.cancel():
            raise asyncio.CancelledError()
        if name not in self.available():
            raise ToolError("Tool unavailable or not permitted by the current plan")
        args = TOOL_SPECS[name][0].model_validate(raw_args).model_dump()
        previous = self.db.one("SELECT * FROM tool_calls WHERE id=? AND run_id=?", (call_id, run_id))
        if previous and previous["status"] == "done":
            return json.loads(previous["result"])
        if previous and previous["status"] == "started" and not TOOL_SPECS[name][3]:
            raise ToolError("Prior non-idempotent call outcome is uncertain; inspect state and issue a new call")
        self.db.execute("""INSERT INTO tool_calls VALUES (?,?,?,?,?,?) ON CONFLICT(id)
        DO UPDATE SET status='started'""", (call_id, run_id, name, "started", "{}", time.time()))
        try:
            self.run_id = run_id
            result = await asyncio.wait_for(self._execute(name, args), timeout=20)
            result["evidence_id"] = call_id
            # Store output before the model is allowed to use it.
            self.db.execute("UPDATE tool_calls SET status='done',result=? WHERE id=?",
                            (json.dumps(result, ensure_ascii=False), call_id))
            return result
        except asyncio.CancelledError:
            raise
        except Exception as e:
            self.db.execute("UPDATE tool_calls SET status='failed',result=? WHERE id=?",
                            (json.dumps({"error": str(e)[:400]}), call_id))
            raise

    async def _execute(self, name, args):
        if name == "update_workflow":
            rows = self.db.all("SELECT * FROM task_nodes WHERE run_id=?", (self.run_id,))
            nodes = {r["node_id"]: {"node_id":r["node_id"], "objective":r["objective"],
                "status":r["status"], "dependencies":json.loads(r["dependencies"]),
                "acceptance":json.loads(r["acceptance"]), "evidence":json.loads(r["evidence"])} for r in rows}
            nodes.update({n["node_id"]: n for n in args["nodes"]})
            if len(nodes) > 30:
                raise ToolError("Task graph exceeds 30 nodes; decompose only as needed")
            visited, stack = set(), set()
            def visit(key):
                if key not in nodes:
                    raise ToolError("Unknown dependency: " + key)
                if key in stack:
                    raise ToolError("Dependency cycle")
                if key in visited:
                    return
                stack.add(key)
                for dep in nodes[key]["dependencies"]:
                    visit(dep)
                stack.remove(key)
                visited.add(key)
            for key in nodes:
                visit(key)
            for node in nodes.values():
                if node["status"] in ("running", "completed") and any(nodes[d]["status"]!="completed" for d in node["dependencies"]):
                    raise ToolError("A node cannot run/complete before its dependencies")
                if node["status"] == "completed":
                    if not node["evidence"]:
                        raise ToolError("Completed nodes require actual successful tool evidence")
                    for proof in node["evidence"]:
                        record = self.db.one("SELECT status,result FROM tool_calls WHERE id=? AND run_id=?",
                                             (proof,self.run_id))
                        if not record or record["status"]!="done":
                            raise ToolError("Unverified evidence reference")
            with self.db.transaction(self.user["id"]):
                for node in args["nodes"]:
                    self.db.execute("""INSERT INTO task_nodes VALUES (?,?,?,?,?,?,?,?)
                    ON CONFLICT(run_id,node_id) DO UPDATE SET objective=excluded.objective,
                    status=excluded.status,dependencies=excluded.dependencies,
                    acceptance=excluded.acceptance,evidence=excluded.evidence,updated=excluded.updated""",
                        (self.run_id,node["node_id"],node["objective"],node["status"],
                         json.dumps(node["dependencies"]),json.dumps(node["acceptance"]),json.dumps(node["evidence"]),time.time()))
            return {"nodes":list(nodes.values()),"method":"validated-dependency-graph"}
        if name == "calculate":
            return calculate(args["expression"])
        if name == "list_files":
            return {"files": self.db.all(
                "SELECT path,updated FROM files WHERE user_id=? AND chat_id=?",
                (self.user["id"], self.chat_id))}
        if name in ("read_file", "validate_file"):
            row = self.file(args["path"])
            if name == "validate_file":
                try:
                    return validate_content(row["path"], row["content"])
                except (json.JSONDecodeError, csv.Error) as e:
                    raise ToolError(str(e)[:300]) from e
            offset, limit = args["offset"], args["limit"]
            return {"path": row["path"], "content": row["content"][offset:offset+limit],
                    "offset": offset, "total_characters": len(row["content"]),
                    "truncated": offset+limit < len(row["content"])}
        if name in ("write_file", "edit_file"):
            path = safe_path(args["path"])
            plan = entitlement(self.user)
            content = args.get("content")
            prior = self.db.one("SELECT content FROM files WHERE user_id=? AND chat_id=? AND path=?",
                                (self.user["id"], self.chat_id, path))
            if name == "edit_file":
                if not prior or prior["content"].count(args["old"]) != 1:
                    raise ToolError("Edit requires exactly one matching fragment; inspect the file first")
                content = prior["content"].replace(args["old"], args["new"], 1)
            if len(content.encode()) > plan["file_bytes"]:
                raise ToolError("Per-file byte limit exceeded")
            with self.db.transaction(self.user["id"]):
                count = self.db.one("SELECT COUNT(*) AS n FROM files WHERE user_id=? AND chat_id=?",
                                    (self.user["id"], self.chat_id))["n"]
                total = self.db.all("SELECT content FROM files WHERE user_id=? AND chat_id=?",
                                    (self.user["id"], self.chat_id))
                total_bytes = sum(len(r["content"].encode()) for r in total)
                old_size = len(prior["content"].encode()) if prior else 0
                if not prior and count >= plan["files"]:
                    raise ToolError("Task file-count limit exceeded")
                if total_bytes - old_size + len(content.encode()) > plan["file_bytes"] * 5:
                    raise ToolError("Total task workspace byte limit exceeded")
                self.db.execute("""INSERT INTO files VALUES (?,?,?,?,?)
                ON CONFLICT(user_id,chat_id,path) DO UPDATE SET content=excluded.content,updated=excluded.updated""",
                                (self.user["id"], self.chat_id, path, content, time.time()))
            return {"path": path, "content": content[:60000], "lines": len(content.splitlines()),
                    "isNew": prior is None, "bytes": len(content.encode())}
        if name == "fetch_page":
            url = await check_url(args["url"])
            async with httpx.AsyncClient(timeout=15, follow_redirects=False, trust_env=False) as client:
                async with client.stream("GET", url, headers={"User-Agent": "APEX-Agent/1.0"}) as response:
                    if response.status_code in (301, 302, 303, 307, 308):
                        raise ToolError("Redirect not followed; inspect the destination explicitly")
                    response.raise_for_status()
                    if not any(t in response.headers.get("content-type", "") for t in ("text/", "json")):
                        raise ToolError("Only text/JSON responses are supported")
                    data = bytearray()
                    async for chunk in response.aiter_bytes():
                        data.extend(chunk)
                        if len(data) > 500000:
                            raise ToolError("Page exceeds size limit")
            raw = data.decode("utf-8", errors="replace")
            raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", raw, flags=re.S | re.I)
            text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
            return {"url": url, "text": re.sub(r"\s+", " ", text)[:16000],
                    "retrieved_at": time.time(), "trust": "untrusted-external-content"}
        if name == "search_web":
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get("https://api.search.brave.com/res/v1/web/search",
                    params={"q": args["query"], "count": 5},
                    headers={"X-Subscription-Token": os.environ["BRAVE_SEARCH_API_KEY"]})
                response.raise_for_status()
                data = response.json()
            return {"query": args["query"], "sources": [
                {"title": r.get("title", ""), "url": r["url"], "snippet": r.get("description", ""),
                 "retrieved_at": time.time()} for r in data.get("web", {}).get("results", [])]}
        raise ToolError("Unsupported tool")
