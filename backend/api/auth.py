"""Google sign-in and cookie sessions.

The browser gets a Google ID token from Google Identity Services and posts it
here. We verify it against GOOGLE_CLIENT_ID, upsert the user, and set an
httpOnly session cookie holding a random token (only its SHA-256 is stored).
"""

import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import requests
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from db import connection, db_status
from settings import (
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    DATABASE_URL,
    DEV_LOGIN,
    GOOGLE_CLIENT_ID,
    SESSION_COOKIE,
    SESSION_DAYS,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_google_request = google_requests.Request()


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _avatar_data_url(picture_url: str) -> str:
    """Google profile photos are cross-origin; store a copy so slides can embed and export it."""
    if not picture_url.startswith("https://"):
        return ""
    url = picture_url.split("=")[0] + "=s256-c" if "googleusercontent.com" in picture_url else picture_url
    try:
        res = requests.get(url, timeout=5)
        kind = res.headers.get("content-type", "").split(";")[0]
        if res.ok and kind.startswith("image/") and len(res.content) < 300_000:
            return f"data:{kind};base64,{base64.b64encode(res.content).decode()}"
    except requests.RequestException:
        pass
    return ""


def _upsert_user(google_sub: str, email: str, name: str, picture_url: str) -> dict:
    with connection() as conn:
        user = conn.execute(
            """
            INSERT INTO users (google_sub, email, name, picture_url)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (google_sub) DO UPDATE
                SET email = EXCLUDED.email, name = EXCLUDED.name,
                    picture_url = EXCLUDED.picture_url, last_login_at = now()
            RETURNING id, email, name, picture_url
            """,
            (google_sub, email, name, picture_url),
        ).fetchone()
        exists = conn.execute("SELECT 1 FROM profiles WHERE user_id = %s", (user["id"],)).fetchone()

    if not exists:
        brand = {"name": name, "avatar": _avatar_data_url(picture_url)}
        with connection() as conn:
            conn.execute(
                "INSERT INTO profiles (user_id, brand) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (user["id"], Jsonb(brand)),
            )
    return user


def _start_session(response: Response, request: Request, user_id) -> None:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(UTC) + timedelta(days=SESSION_DAYS)
    with connection() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = %s AND expires_at < now()", (user_id,))
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at, user_agent) VALUES (%s, %s, %s, %s)",
            (_hash(token), user_id, expires, request.headers.get("user-agent", "")[:300]),
        )
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_DAYS * 86400,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


def current_user(aurea_session: str | None = Cookie(default=None)) -> dict:
    """FastAPI dependency: the signed-in user, or 401."""
    if not aurea_session:
        raise HTTPException(401, "Sign in to continue.")
    with connection() as conn:
        user = conn.execute(
            """
            SELECT u.id, u.email, u.name, u.picture_url
            FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = %s AND s.expires_at > now()
            """,
            (_hash(aurea_session),),
        ).fetchone()
    if not user:
        raise HTTPException(401, "Your session has expired. Sign in again.")
    return user


# ---- routes ---------------------------------------------------------------


@router.get("/config")
def auth_config():
    """What the sign-in page needs to render (no secrets)."""
    return {
        "google_client_id": GOOGLE_CLIENT_ID,
        "database": db_status() if DATABASE_URL else "unconfigured",
        "dev_login": DEV_LOGIN,
    }


class GoogleSignIn(BaseModel):
    credential: str = Field(min_length=20, max_length=4096)


@router.post("/google")
def sign_in_with_google(body: GoogleSignIn, request: Request, response: Response):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google sign-in is not configured. Set GOOGLE_CLIENT_ID on the server.")
    try:
        claims = id_token.verify_oauth2_token(body.credential, _google_request, GOOGLE_CLIENT_ID)
    except ValueError:
        raise HTTPException(401, "Google sign-in failed. Please try again.") from None
    if not claims.get("email_verified"):
        raise HTTPException(403, "Your Google email address is not verified.")

    user = _upsert_user(claims["sub"], claims["email"], claims.get("name", ""), claims.get("picture", ""))
    _start_session(response, request, user["id"])
    return {"ok": True}


@router.post("/dev-login")
def dev_login(request: Request, response: Response):
    host = request.client.host if request.client else ""
    if not DEV_LOGIN or host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(404)
    user = _upsert_user("dev-local", "dev@localhost", "Local Developer", "")
    _start_session(response, request, user["id"])
    return {"ok": True}


@router.post("/logout")
def logout(response: Response, aurea_session: str | None = Cookie(default=None)):
    if aurea_session and DATABASE_URL:
        with connection() as conn:
            conn.execute("DELETE FROM sessions WHERE token_hash = %s", (_hash(aurea_session),))
    response.delete_cookie(SESSION_COOKIE, path="/", secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE)
    return {"ok": True}


@router.get("/me")
def me(user: dict = Depends(current_user)):
    with connection() as conn:
        profile = conn.execute(
            "SELECT brand, social, onboarded_at FROM profiles WHERE user_id = %s", (user["id"],)
        ).fetchone() or {"brand": {}, "social": {}, "onboarded_at": None}
    return {
        "user": {"id": str(user["id"]), "email": user["email"], "name": user["name"], "picture": user["picture_url"]},
        "profile": {
            "brand": profile["brand"],
            "social": profile["social"],
            "onboarded": profile["onboarded_at"] is not None,
        },
    }
