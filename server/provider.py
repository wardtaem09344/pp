"""OpenAI-compatible provider adapter with bounded retry and honest errors."""
import asyncio
import os
import json
import re
import time
import uuid
from urllib.parse import urlparse

import httpx


class ProviderError(Exception):
    def __init__(self, code, message, retryable=False):
        self.code, self.retryable = code, retryable
        super().__init__(message)


def configured_models():
    models = []
    for tier, env in (("fast", "FAST_MODEL"), ("standard", "STANDARD_MODEL"), ("advanced", "ADVANCED_MODEL")):
        model = os.getenv(env, "")
        if model:
            models.append({"id": tier, "provider_model": model, "label": model})
    return models


class Provider:
    def __init__(self, db=None):
        self.db = db
        # Vault proxy variable names can be provided without embedding credentials.
        url_var, token_var = os.getenv("PROVIDER_URL_ENV", ""), os.getenv("PROVIDER_TOKEN_ENV", "")
        self.proxy_url = os.getenv(url_var, "") if url_var else ""
        self.proxy_token = os.getenv(token_var, "") if token_var else ""
        # Reuse Gemini when that is the provider configured by the project owner.
        # Its OpenAI-compatible endpoint preserves real tool calls, not prompt-only emulation.
        gemini = os.getenv("GEMINI_API_KEY", "")
        default_base = "https://generativelanguage.googleapis.com/v1beta/openai" if gemini and not os.getenv("OPENAI_API_KEY") else "https://api.openai.com/v1"
        self.base = os.getenv("OPENAI_BASE_URL", default_base).rstrip("/")
        self.key = os.getenv("OPENAI_API_KEY", "") or gemini
        self.gemini_key = gemini
        self.gemini_url = os.getenv("CUSTOM_CRED_GENERATIVELANGUAGE_GOOGLEAPIS_COM_URL", "")
        self.gemini_proxy_key = os.getenv("CUSTOM_CRED_GENERATIVELANGUAGE_GOOGLEAPIS_COM_PROXY_AUTH_KEY", "")
        self.seek_key = os.getenv("AISEEK_ACCESS_TOKEN", "")
        self.seek_url = os.getenv("CUSTOM_CRED_AI_SEEK_THEBETTER_AI_URL", "")
        self.seek_proxy_key = os.getenv("CUSTOM_CRED_AI_SEEK_THEBETTER_AI_PROXY_AUTH_KEY", "")
        self.ready = bool(self.seek_key or self.gemini_key or
                          (self.seek_url and self.seek_proxy_key) or
                          (self.gemini_url and self.gemini_proxy_key) or
                          ((self.key or (self.proxy_url and self.proxy_token)) and configured_models()))

    def models(self):
        result = [{**m, "tier": m["id"], "provider": "openai", "status": "configured"}
                  for m in configured_models()]
        if self.gemini_key or self.gemini_url:
            if not result:
                result.append({"id": "gemini:gemini-3.8-flash", "provider": "gemini",
                    "provider_model": "gemini-3.8-flash", "label": "Gemini 3.8 Flash",
                    "tier": "fast", "status": "configured-not-yet-verified"})
        if self.seek_key or self.seek_url:
            from .provider_probe import AISEEK_MODELS
            for model in AISEEK_MODELS.values():
                tier = "advanced" if model.startswith("anthropic/") else "standard" if model.startswith("grok/") else "fast"
                result.append({"id": "aiseek:" + model, "provider": "aiseek", "provider_model": model,
                               "label": model, "tier": tier, "status": "provided-candidate"})
            if not any(m["id"] == "fast" for m in result):
                result.append({"id": "fast", "provider": "aiseek", "provider_model": AISEEK_MODELS["deepseek"],
                               "label": "DeepSeek", "tier": "fast", "status": "provided-candidate"})
        if self.db:
            for r in self.db.all("SELECT * FROM provider_models ORDER BY label"):
                row = {"id": r["id"], "provider": r["provider"], "provider_model": r["model"],
                       "label": r["label"], "tier": r["tier"], "status": r["status"]}
                result = [m for m in result if m["id"] != row["id"]]
                result.append(row)
        return result

    def tier(self, model):
        return next((m["tier"] for m in self.models() if m["id"] == model), model)

    def _gemini_endpoint(self, path):
        base = self.gemini_url or "https://generativelanguage.googleapis.com"
        headers = {"x-api-key": self.gemini_proxy_key} if self.gemini_url else {"x-goog-api-key": self.gemini_key}
        return base.rstrip("/") + path, headers

    async def discover(self):
        if not self.db:
            raise ProviderError("no_catalog_storage", "Model catalogue storage unavailable")
        discovered = []
        if self.gemini_key or self.gemini_url:
            token = ""
            async with httpx.AsyncClient(timeout=30) as client:
                for _ in range(10):
                    endpoint, headers = self._gemini_endpoint("/v1beta/models")
                    response = await client.get(endpoint, headers=headers, params={"pageSize": 100, **({"pageToken": token} if token else {})})
                    if response.status_code in (401, 403):
                        raise ProviderError("gemini_auth", "Gemini refused model listing; check the saved key and header")
                    response.raise_for_status()
                    data = response.json()
                    for m in data.get("models", []):
                        if "generateContent" not in m.get("supportedGenerationMethods", []):
                            continue
                        model = m["name"].removeprefix("models/")
                        # Models whose purpose is media generation are not text-chat claims.
                        if any(w in model.lower() for w in ("image", "tts", "robotics", "computer-use", "live", "audio", "aqa")):
                            continue
                        tier = "advanced" if "pro" in model else "fast" if "flash" in model else "standard"
                        entry = ("gemini:" + model, "gemini", model, m.get("displayName", model),
                                 tier, "listed-by-provider", time.time())
                        self.db.execute("""INSERT INTO provider_models VALUES (?,?,?,?,?,?,?)
                        ON CONFLICT(id) DO UPDATE SET label=excluded.label,tier=excluded.tier,
                        status=excluded.status,updated=excluded.updated""", entry)
                        discovered.append(entry[0])
                    token = data.get("nextPageToken", "")
                    if not token:
                        break
        # ai-seek has no confirmed model-discovery endpoint. Candidate names come
        # from the user's wrapper, and must never be labelled provider-discovered.
        return {"discovered": discovered, "models": self.models(),
                "aiseek_discovery": "No documented listing endpoint supplied; seven candidates from user integration, not an exhaustive provider catalogue."}

    async def _gemini(self, messages, tools, match, output_tokens, cancel):
        system = "\n".join(m.get("content", "") for m in messages if m["role"] == "system")
        contents, names = [], {}
        for m in messages:
            if m["role"] == "system":
                continue
            parts = []
            if m.get("content"):
                parts.append({"text": str(m["content"])})
            for c in m.get("tool_calls", []):
                names[c["id"]] = c["function"]["name"]
                args = c["function"].get("arguments", "{}")
                parts.append({"functionCall": {"name": c["function"]["name"],
                                               "args": json.loads(args) if isinstance(args, str) else args}})
            if m.get("native_parts"):
                parts = ([{"text": str(m["content"])}] if m.get("content") else []) + m["native_parts"]
            if m["role"] == "tool":
                parts = [{"functionResponse": {"name": names.get(m["tool_call_id"], "unknown"),
                    "response": json.loads(m["content"])}}]
            if parts:
                role = "model" if m["role"] == "assistant" else "user"
                if contents and contents[-1]["role"] == role:
                    contents[-1]["parts"].extend(parts)
                else:
                    contents.append({"role": role, "parts": parts})
        body = {"systemInstruction": {"parts": [{"text": system}]}, "contents": contents,
                "generationConfig": {"maxOutputTokens": output_tokens}}
        if tools:
            def clean_schema(value, definitions=None):
                definitions = definitions or (value.get("$defs", {}) if isinstance(value,dict) else {})
                if isinstance(value, dict):
                    if "$ref" in value:
                        return clean_schema(definitions.get(value["$ref"].split("/")[-1], {}), definitions)
                    return {k: clean_schema(v, definitions) for k, v in value.items() if k not in ("additionalProperties", "title", "default", "$schema", "$defs")}
                if isinstance(value, list):
                    return [clean_schema(x, definitions) for x in value]
                return value
            body["tools"] = [{"functionDeclarations": [
                {"name": t["function"]["name"], "description": t["function"]["description"],
                 "parameters": clean_schema(t["function"]["parameters"])} for t in tools]}]
        model = match["provider_model"]
        if not re.fullmatch(r"[\w.-]+", model):
            raise ProviderError("invalid_model", "Invalid Gemini model name")
        endpoint, headers = self._gemini_endpoint("/v1beta/models/" + model + ":generateContent")
        data = await self._post_json(endpoint, body, headers, cancel)
        try:
            parts = data["candidates"][0]["content"]["parts"]
            text, calls = [], []
            for p in parts:
                if p.get("thought"):
                    continue
                if "text" in p:
                    text.append(p["text"])
                if "functionCall" in p:
                    c = p["functionCall"]
                    calls.append({"id": uid_call(), "type": "function", "function": {
                        "name": c["name"], "arguments": json.dumps(c.get("args", {}))}})
            message = {"role": "assistant", "content": "".join(text)}
            if calls:
                message["tool_calls"] = calls
                message["native_parts"] = [p for p in parts if "functionCall" in p]
            spent = data.get("usageMetadata", {})
            return message, {"input_tokens": spent.get("promptTokenCount", 0), "output_tokens": spent.get("candidatesTokenCount", 0)}
        except (KeyError, IndexError, TypeError) as e:
            raise ProviderError("gemini_invalid_response", "Gemini returned no usable text or tools") from e

    async def _post_json(self, endpoint, body, headers, cancel):
        async with httpx.AsyncClient(timeout=90) as client:
            for attempt in range(3):
                if cancel():
                    raise asyncio.CancelledError()
                try:
                    response = await client.post(endpoint, json=body, headers=headers)
                    if response.status_code in (401, 403):
                        raise ProviderError("provider_auth", "Provider refused credentials or account permissions")
                    if response.status_code in (408, 429, 500, 502, 503, 504):
                        if attempt < 2:
                            await asyncio.sleep(.5 * 2 ** attempt)
                            continue
                        raise ProviderError("provider_unavailable", "Provider unavailable after bounded retries", True)
                    if response.is_error:
                        raise ProviderError("provider_invalid_request", "Provider rejected request: HTTP " + str(response.status_code))
                    return response.json()
                except (httpx.TimeoutException, httpx.NetworkError) as e:
                    if attempt == 2:
                        raise ProviderError("provider_timeout", "Provider request timed out", True) from e
                    await asyncio.sleep(.5 * 2 ** attempt)

    async def _aiseek(self, messages, tools, match, output_tokens, cancel):
        # This service supplies text SSE, not native function calls. A strict
        # JSON tool-request protocol is parsed and sent to the same real registry.
        # No fictional autonomous execution is inferred from generated prose.
        protocol = ""
        if tools:
            protocol = """\nTOOL PROTOCOL: Return exactly one JSON object, no markdown.
Either {"type":"final","content":"your answer"} or
{"type":"tool_calls","calls":[{"name":"tool name","arguments":{...}}]}.
Tool operations happen only after the server validates and executes your calls.
Never claim a tool ran before its real result is provided.
Available tool schemas:\n""" + json.dumps(tools, ensure_ascii=False)
        text = json.dumps(messages, ensure_ascii=False) + protocol
        endpoint = (self.seek_url or "https://ai-seek.thebetter.ai").rstrip("/") + "/v4/chat/send"
        headers = {"Accept": "text/event-stream", "Content-Type": "application/json", "x-app-id": "ai-seek",
                   "User-Agent": "okhttp/4.12.0", "x-guru-internal-receive-timeout-ms": "120000"}
        if self.seek_url:
            headers["x-api-key"] = self.seek_proxy_key
        else:
            headers["x-access-token"] = self.seek_key
        payload = {"sessionId": uid_call(), "userMessageId": uid_call(), "aiMessageId": uid_call(),
                   "model": match["provider_model"], "text": text,
                   "restrictedType": "FREE_USER", "sessionType": "NORMAL"}
        output = ""
        # Do not retry uncertain SSE generations: they may already have been billed.
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120, connect=15)) as client:
                async with client.stream("POST", endpoint, json=payload, headers=headers) as response:
                    if response.status_code in (401, 403):
                        raise ProviderError("aiseek_auth", "ai-seek requires a valid x-access-token header")
                    if response.is_error:
                        raise ProviderError("aiseek_error", "ai-seek HTTP " + str(response.status_code))
                    async for line in response.aiter_lines():
                        if cancel():
                            raise asyncio.CancelledError()
                        if not line.startswith("data:"):
                            continue
                        raw = line[5:].strip()
                        if raw == "[DONE]":
                            break
                        try:
                            data = json.loads(raw)
                        except ValueError:
                            continue
                        if data.get("error"):
                            raise ProviderError("aiseek_rejected", "ai-seek rejected this model or account request")
                        content = data.get("content")
                        if isinstance(content, str):
                            output += content
                        if len(output) > output_tokens * 12:
                            raise ProviderError("output_limit", "ai-seek response exceeds output ceiling")
        except (httpx.TimeoutException, httpx.NetworkError) as e:
            raise ProviderError("aiseek_transport", "ai-seek connection failed; not retried to avoid duplicate generation", True) from e
        output = re.sub(r"<think>.*?</think>", "", output, flags=re.S).strip()
        if "<think>" in output:
            output = output.split("<think>")[0].strip()
        if not output:
            raise ProviderError("aiseek_empty", "ai-seek returned no usable content")
        if not tools:
            return {"role": "assistant", "content": output}, {}
        try:
            clean = re.sub(r"^```(?:json)?\s*|\s*```$", "", output).strip()
            result = json.loads(clean)
            if result.get("type") == "tool_calls":
                calls = result.get("calls", [])
                if not isinstance(calls, list) or not calls or len(calls) > 8:
                    raise ValueError("invalid tool batch")
                return {"role": "assistant", "content": None, "tool_calls": [
                    {"id": uid_call(), "type": "function", "function": {
                        "name": c["name"], "arguments": json.dumps(c["arguments"], ensure_ascii=False)}} for c in calls]}, {}
            if result.get("type") == "final" and isinstance(result.get("content"), str):
                return {"role": "assistant", "content": result["content"]}, {}
        except (ValueError, KeyError, TypeError):
            pass
        raise ProviderError("aiseek_protocol", "Model did not follow the JSON tool protocol; no operation was simulated")

    async def complete(self, messages, tools, model, output_tokens, cancel=lambda: False):
        if not self.ready:
            raise ProviderError("provider_not_configured", "لم يُضبط مزوّد النماذج بعد. أضف مفتاح الخادم واسم النموذج أولًا.")
        match = next((m for m in self.models() if m["id"] == model), None)
        if not match:
            raise ProviderError("model_not_configured", "The selected model is not configured")
        if match.get("provider") == "gemini":
            return await self._gemini(messages, tools, match, output_tokens, cancel)
        if match.get("provider") == "aiseek":
            return await self._aiseek(messages, tools, match, output_tokens, cancel)
        body = {"model": match["provider_model"], "messages": messages, "max_completion_tokens": output_tokens}
        if "generativelanguage.googleapis.com" in self.base:
            body["max_tokens"] = body.pop("max_completion_tokens")
        if tools:
            body["tools"] = tools
        endpoint = (self.proxy_url.rstrip("/") + "/v1/chat/completions") if self.proxy_url else self.base + "/chat/completions"
        if urlparse(endpoint).scheme != "https":
            raise ProviderError("invalid_provider_url", "Production model endpoints must use HTTPS")
        headers = {"x-api-key": self.proxy_token} if self.proxy_url else {"Authorization": "Bearer " + self.key}
        async with httpx.AsyncClient(timeout=httpx.Timeout(90, connect=15)) as client:
            for attempt in range(3):
                if cancel():
                    raise asyncio.CancelledError()
                try:
                    response = await client.post(endpoint, json=body, headers=headers)
                except (httpx.TimeoutException, httpx.NetworkError) as e:
                    if attempt == 2:
                        raise ProviderError("provider_timeout", "Model request timed out", True) from e
                    await asyncio.sleep(0.5 * (2 ** attempt))
                    continue
                if response.status_code in (401, 403):
                    raise ProviderError("provider_auth", "Provider authentication or permission failed; no automatic broader credentials")
                if response.status_code in (408, 429, 500, 502, 503, 504):
                    if attempt < 2:
                        await asyncio.sleep(0.5 * (2 ** attempt))
                        continue
                    raise ProviderError("provider_unavailable", "Provider unavailable after three bounded attempts", True)
                if response.is_error:
                    raise ProviderError("provider_invalid_request", "Provider rejected the request (HTTP " + str(response.status_code) + ")")
                try:
                    data = response.json()
                    message = data["choices"][0]["message"]
                    if not isinstance(message, dict) or not (message.get("content") or message.get("tool_calls")):
                        raise ValueError("empty message")
                    return message, data.get("usage", {})
                except (KeyError, IndexError, TypeError, ValueError) as e:
                    raise ProviderError("provider_invalid_response", "Provider returned an invalid response") from e


def uid_call():
    # UUIDv7, with fresh per-call/per-session identifiers. Never reuse the
    # fixed Android application conversation IDs supplied in sample code.
    ms = int(time.time() * 1000)
    rand = uuid.uuid4().int
    value = ((ms & ((1 << 48) - 1)) << 80) | (7 << 76) | (rand & ((1 << 76) - 1))
    value = (value & ~(3 << 62)) | (2 << 62)
    return str(uuid.UUID(int=value))
