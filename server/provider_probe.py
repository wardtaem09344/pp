"""Run only through approved host credential proxy. Never prints secrets."""
import json
import sys
import uuid
import subprocess

import requests
import os

os.environ.setdefault("REQUESTS_CA_BUNDLE", "/etc/ssl/certs/ca-certificates.crt")

AISEEK_MODELS = {
    "deepseek": "deepseek/deepseek-chat",
    "gemini": "google/gemini-2.5-flash-lite",
    "qwen": "qwen/qwen3-32b",
    "qwen-coder": "qwen/qwen-coder-32b",
    "grok": "grok/grok-4-fast",
    "gpt-5": "openai/gpt-5-mini",
    "claude": "anthropic/claude-3.5-sonnet",
}


def main():
    if sys.argv[1:2] == ["gemini"]:
        r = requests.get("https://generativelanguage.googleapis.com/v1beta/models", timeout=30)
        print(json.dumps({"operation": "list_models", "status": r.status_code,
            "result": r.json() if r.status_code == 200 else r.text[:500]}, ensure_ascii=False))
        return
    if sys.argv[1:2] == ["list"]:
        r = requests.get("https://ai-seek.thebetter.ai/v4/chat/models",
                         headers={"x-app-id": "ai-seek"}, timeout=30)
        print(json.dumps({"operation": "list_models_candidate", "status": r.status_code, "body": r.text[:1200]}))
        return
    selected = sys.argv[1:] or ["deepseek"]
    for key in selected:
        payload = {"sessionId": str(uuid.uuid4()), "userMessageId": str(uuid.uuid4()),
                   "aiMessageId": str(uuid.uuid4()), "model": AISEEK_MODELS[key],
                   "text": "Reply with exactly APEX_OK. This is a minimal authorized connectivity test.",
                   "restrictedType": "FREE_USER", "sessionType": "NORMAL"}
        output = ""
        try:
            proc = subprocess.run(["curl", "--silent", "--show-error", "--max-time", "90",
                "--request", "POST", "--header", "Accept: text/event-stream",
                "--header", "Content-Type: application/json", "--header", "x-app-id: ai-seek",
                "--data-binary", "@-", "--write-out", "\nAPEX_HTTP:%{http_code}",
                "https://ai-seek.thebetter.ai/v4/chat/send"], input=json.dumps(payload),
                text=True, capture_output=True, timeout=100)
            raw, _, status = proc.stdout.rpartition("\nAPEX_HTTP:")
            if status != "200":
                print(json.dumps({"model": AISEEK_MODELS[key], "status": status, "error": raw[:400], "transport": proc.stderr[:200]}))
                continue
            for line in raw.splitlines():
                    if line.startswith("data:"):
                        try:
                            data = json.loads(line[5:].strip())
                            output += data.get("content", "")
                            if data.get("error"):
                                output += json.dumps(data["error"])
                        except (ValueError, TypeError):
                            pass
                    if len(output) > 500:
                        break
            print(json.dumps({"model": AISEEK_MODELS[key], "status": status,
                              "verified_response": "APEX_OK" in output, "response": output[:250]}))
        except requests.RequestException as e:
            print(json.dumps({"model": AISEEK_MODELS[key], "error_type": type(e).__name__}))


if __name__ == "__main__":
    main()
