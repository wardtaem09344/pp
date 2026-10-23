import hashlib
import hmac
import os
import secrets
import time

from fastapi import HTTPException, Request

COOKIE = "__Host-apex"


def password_hash(value):
    salt = secrets.token_hex(16)
    digest = hashlib.scrypt(value.encode(), salt=salt.encode(), n=16384, r=8, p=1).hex()
    return salt + ":" + digest


def password_matches(value, encoded):
    try:
        salt, target = encoded.split(":")
        actual = hashlib.scrypt(value.encode(), salt=salt.encode(), n=16384, r=8, p=1).hex()
        return hmac.compare_digest(actual, target)
    except (ValueError, TypeError):
        return False


def public_user(user):
    return {k: user[k] for k in ("id", "email", "name", "role", "plan", "created")}


def token_digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db, user_id, response):
    token = secrets.token_urlsafe(48)
    db.execute("INSERT INTO sessions VALUES (?,?,?)",
               (token_digest(token), user_id, time.time() + 7 * 86400))
    response.set_cookie(COOKIE, token, secure=True, httponly=True, samesite="lax", path="/", max_age=7 * 86400)
    return token


def current_user(request: Request):
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get(COOKIE, "")
    if not token:
        raise HTTPException(401, "unauthenticated")
    user = request.app.state.db.one("""SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id
    WHERE s.digest=? AND s.expires>?""", (token_digest(token), time.time()))
    if not user:
        raise HTTPException(401, "unauthenticated")
    # Cookie requests require same-origin intent. The browser client sends a custom
    # content-type/header; no wildcard CORS. Bearer requests authenticate explicitly.
    if not auth and request.method not in ("GET", "HEAD", "OPTIONS"):
        if request.headers.get("sec-fetch-site") == "cross-site":
            raise HTTPException(403, "cross_site_request")
        if request.headers.get("content-type", "").split(";")[0] != "application/json":
            raise HTTPException(403, "json_required")
    return user


def owner(request):
    user = current_user(request)
    if user["role"] != "owner":
        raise HTTPException(403, "owner_required")
    return user
