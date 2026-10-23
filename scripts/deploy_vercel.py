"""Deploy source through the connected Vercel CLI API, without exposing its token."""
import base64
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    files = []
    for folder in ("app", "server", "api"):
        for path in sorted((ROOT / folder).rglob("*")):
            if path.is_file() and "__pycache__" not in path.parts:
                files.append({"file": str(path.relative_to(ROOT)), "encoding": "base64",
                              "data": base64.b64encode(path.read_bytes()).decode()})
    for name in ("requirements.txt", "vercel.json"):
        files.append({"file": name, "encoding": "base64",
                      "data": base64.b64encode((ROOT / name).read_bytes()).decode()})
    payload = {"name": "mmm-apex-agent", "project": "prj_FWMRuSIPBwLTeAx76LL4o7pfPbQT",
               "target": "production", "files": files, "projectSettings": {"framework": None},
               "meta": {"release": "apex-1.0.0"}}
    result = subprocess.run(["vercel", "api", "/v13/deployments", "--method", "POST",
        "--input", "-", "--token", os.environ["VERCEL_TOKEN"], "--raw"],
        input=json.dumps(payload), text=True, check=False)
    if result.returncode:
        raise SystemExit("Vercel deployment failed. Check the access error above; no deployment was confirmed.")


if __name__ == "__main__":
    main()
