"""Local admin operations; never expose bootstrap over public HTTP."""
import argparse
import getpass
import time

from .auth import password_hash
from .db import Database, uid
from .plans import PLANS


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="operation", required=True)
    create = sub.add_parser("create-owner")
    create.add_argument("email")
    create.add_argument("--name", default="APEX owner")
    grant = sub.add_parser("set-plan")
    grant.add_argument("email")
    grant.add_argument("plan", choices=list(PLANS))
    sub.add_parser("schema")
    args = p.parse_args()
    db = Database()
    if args.operation == "create-owner":
        if db.one("SELECT id FROM users WHERE email=?", (args.email.lower(),)):
            raise SystemExit("Account exists. Use an authorized database admin to promote it.")
        password = getpass.getpass("Owner password (at least 12 characters): ")
        if len(password) < 12 or password != getpass.getpass("Confirm password: "):
            raise SystemExit("Invalid password or mismatch")
        db.execute("INSERT INTO users VALUES (?,?,?,?,?,?,?,?)",
            (uid(), args.email.lower(), args.name, password_hash(password), "owner", "ultra", time.time(), "{}"))
        print("Owner created. No password was written to source or logs.")
    elif args.operation == "set-plan":
        user = db.one("SELECT id FROM users WHERE email=?", (args.email.lower(),))
        if not user:
            raise SystemExit("Account not found")
        db.execute("UPDATE users SET plan=? WHERE id=?", (args.plan, user["id"]))
        db.audit("local-admin", "set_plan", args.email + ":" + args.plan)
        print("Plan updated.")
    elif args.operation == "schema":
        from .db import SCHEMA
        print(";\n".join(SCHEMA))


if __name__ == "__main__":
    main()
