"""Authoritative entitlements. Never accept a plan from the client."""
import datetime

from fastapi import HTTPException

PLANS = {
    "free": dict(label="Free", messages=20, agent=0, research=0, steps=0, concurrent=1,
                 files=0, file_bytes=0, context=6000, output_tokens=1500,
                 models=["fast", "standard"], tools=[], memory=False, resume=False),
    "plus": dict(label="Plus", messages=200, agent=10, research=0, steps=8, concurrent=1,
                 files=10, file_bytes=100000, context=16000, output_tokens=3000,
                 models=["fast", "standard"], tools=["calculate", "list_files", "read_file", "write_file", "edit_file", "validate_file", "update_workflow"],
                 memory=False, resume=False),
    "pro": dict(label="Pro", messages=1000, agent=50, research=20, steps=24, concurrent=2,
                files=50, file_bytes=500000, context=48000, output_tokens=6000,
                models=["fast", "standard", "advanced"],
                tools=["calculate", "list_files", "read_file", "write_file", "edit_file", "validate_file", "generate_image", "fetch_page", "search_web", "update_workflow"],
                memory=True, resume=True),
    "ultra": dict(label="Ultra", messages=5000, agent=200, research=100, steps=60, concurrent=4,
                  files=200, file_bytes=2000000, context=100000, output_tokens=12000,
                  models=["fast", "standard", "advanced"],
                  tools=["calculate", "list_files", "read_file", "write_file", "edit_file", "validate_file", "generate_image", "fetch_page", "search_web", "update_workflow"],
                  memory=True, resume=True),
}


def today():
    return datetime.datetime.now(datetime.timezone.utc).date().isoformat()


def entitlement(user):
    return PLANS.get(user.get("plan"), PLANS["free"])


def usage(db, user):
    return {r["metric"]: r["amount"] for r in db.all(
        "SELECT metric,amount FROM usage WHERE user_id=? AND day=?", (user["id"], today()))}


def reserve(db, user, mode):
    """Call inside a user-locked transaction, alongside run insertion."""
    plan = entitlement(user)
    metrics = ["messages"] + (["agent"] if mode == "agent" else ["research"] if mode == "research" else [])
    used = usage(db, user)
    for metric in metrics:
        if plan[metric] == 0:
            raise HTTPException(403, detail={"code": "plan_required", "feature": metric})
        if used.get(metric, 0) >= plan[metric]:
            raise HTTPException(429, detail={"code": "quota_exceeded", "feature": metric, "reset": "00:00 UTC"})
    count = db.one("SELECT COUNT(*) AS n FROM runs WHERE user_id=? AND status IN ('queued','running')", (user["id"],))["n"]
    if count >= plan["concurrent"]:
        raise HTTPException(429, detail={"code": "concurrency_limit"})
    for metric in metrics:
        db.execute("""INSERT INTO usage(user_id,day,metric,amount) VALUES(?,?,?,1)
        ON CONFLICT(user_id,day,metric) DO UPDATE SET amount=usage.amount+1""",
                   (user["id"], today(), metric))
