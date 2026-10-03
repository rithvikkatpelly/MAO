"""Instagram: connect a professional account and publish posts to it.

Uses the Instagram API with Instagram Login (graph.instagram.com), which works with
Business and Creator accounts and needs no Facebook Page.

Connecting:
    1. GET  /connect     returns the Instagram sign-in URL, with a signed state naming the user.
    2. Instagram redirects to GET /callback on PUBLIC_API_URL, which bounces the code to the
       web app. (The session cookie belongs to the app's API origin, which in development is
       not the public tunnel, so the code is finished from the app instead.)
    3. POST /connect     with the code and state, under the user's session. The state must
       name the same user, so a link started by someone else cannot attach their account here.
       We trade the code for a 60-day token, store it encrypted, and refresh it when it nears expiry.

Publishing:
    Instagram downloads post images from a public URL. The browser renders each slide to a
    JPEG and uploads it (POST /media); we serve it at an unguessable URL (GET /media/{token}.jpg),
    create one container per image (plus a carousel container for 2 or more), wait for them to
    process, publish, then delete the staged images.
"""

import base64
import hashlib
import hmac
import secrets
import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated
from urllib.parse import urlencode

import requests
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import RedirectResponse
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field, StringConstraints

from api.auth import current_user
from api.items import _upsert_many, _validate
from db import connection
from settings import (
    APP_URL,
    INSTAGRAM_APP_ID,
    INSTAGRAM_APP_SECRET,
    INSTAGRAM_GRAPH_VERSION,
    PUBLIC_API_URL,
    SECRET_KEY,
)

router = APIRouter(prefix="/api/instagram", tags=["instagram"])

PLATFORM = "instagram"
SCOPES = "instagram_business_basic,instagram_business_content_publish"
AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize"
TOKEN_URL = "https://api.instagram.com/oauth/access_token"
GRAPH = "https://graph.instagram.com"

STATE_TTL = 15 * 60
REFRESH_WITHIN = timedelta(days=7)  # refresh a long-lived token when it has less than this left
MEDIA_TTL = "1 day"
MAX_IMAGE_BYTES = 8 * 1024 * 1024  # Instagram's limit for feed images
MAX_CAROUSEL = 10
MAX_CAPTION = 2200
PROCESS_TIMEOUT = 90  # seconds to wait for Instagram to process the containers

MediaToken = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{32,64}$")]


# ---- configuration and crypto -------------------------------------------------------


def _missing_settings() -> list[str]:
    missing = [
        name
        for name, value in [
            ("INSTAGRAM_APP_ID", INSTAGRAM_APP_ID),
            ("INSTAGRAM_APP_SECRET", INSTAGRAM_APP_SECRET),
            ("SECRET_KEY", SECRET_KEY),
        ]
        if not value
    ]
    if not PUBLIC_API_URL.startswith("https://"):
        missing.append("PUBLIC_API_URL (https)")
    return missing


def _require_configured() -> None:
    missing = _missing_settings()
    if missing:
        raise HTTPException(503, f"Instagram is not set up on the server. Missing: {', '.join(missing)}.")


def _redirect_uri() -> str:
    return f"{PUBLIC_API_URL}/api/instagram/callback"


def _fernet() -> Fernet:
    key = hashlib.sha256(f"aurea-social-tokens:{SECRET_KEY}".encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def _sign(message: str) -> str:
    return hmac.new(f"aurea-oauth-state:{SECRET_KEY}".encode(), message.encode(), hashlib.sha256).hexdigest()


def _make_state(user_id) -> str:
    message = f"{user_id}.{int(time.time()) + STATE_TTL}.{secrets.token_urlsafe(12)}"
    return f"{message}.{_sign(message)}"


def _check_state(state: str, user_id) -> None:
    message, _, signature = state.rpartition(".")
    owner, _, rest = message.partition(".")
    expires = rest.partition(".")[0]
    if not (message and hmac.compare_digest(_sign(message), signature)):
        raise HTTPException(400, "This Instagram sign-in link is not valid. Start again from Connections.")
    if owner != str(user_id):
        raise HTTPException(403, "This Instagram sign-in was started from a different Aurea account.")
    if not expires.isdigit() or int(expires) < time.time():
        raise HTTPException(400, "This Instagram sign-in took too long. Start again from Connections.")


# ---- Graph API ------------------------------------------------------------------------


class GraphError(Exception):
    def __init__(self, message: str, code: int | None = None):
        super().__init__(message)
        self.code = code


def _graph(method: str, url: str, **kwargs) -> dict:
    try:
        res = requests.request(method, url, timeout=30, **kwargs)
    except requests.RequestException as exc:
        raise GraphError(f"Could not reach Instagram: {exc}") from None
    try:
        data = res.json()
    except ValueError:
        data = {}
    if not isinstance(data, dict):
        data = {}
    if not res.ok or "error" in data:
        err = data.get("error")
        if isinstance(err, dict):
            message, code = err.get("error_user_msg") or err.get("message"), err.get("code")
        else:  # the token endpoint reports errors as flat fields
            message, code = data.get("error_message") or err, data.get("code")
        raise GraphError(message or f"Instagram returned {res.status_code}", code)
    return data


def _api(path: str) -> str:
    return f"{GRAPH}/{INSTAGRAM_GRAPH_VERSION}/{path}"


def _fail(exc: GraphError, user_id=None):
    """Turns a Graph error into an HTTP error. An invalid token (190) disconnects the account."""
    if exc.code == 190 and user_id is not None:
        _delete_account(user_id)
        raise HTTPException(401, "Instagram signed this account out. Connect it again from Connections.") from None
    raise HTTPException(502, f"Instagram: {exc}") from None


# ---- stored account -------------------------------------------------------------------


def _save_account(user_id, token: str, expires_in: int | None) -> dict:
    me = _graph("GET", _api("me"), params={"fields": "user_id,username,name,account_type,profile_picture_url", "access_token": token})
    profile = {k: me.get(k, "") for k in ("name", "account_type", "profile_picture_url")}
    expires_at = datetime.now(UTC) + timedelta(seconds=expires_in) if expires_in else None
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO social_accounts (user_id, platform, account_id, username, profile, access_token, token_expires_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, platform) DO UPDATE
                SET account_id = EXCLUDED.account_id, username = EXCLUDED.username, profile = EXCLUDED.profile,
                    access_token = EXCLUDED.access_token, token_expires_at = EXCLUDED.token_expires_at,
                    connected_at = now(), updated_at = now()
            """,
            (user_id, PLATFORM, str(me.get("user_id") or me["id"]), me.get("username", ""), Jsonb(profile),
             _fernet().encrypt(token.encode()).decode(), expires_at),
        )
    return _load_account(user_id)


def _load_account(user_id) -> dict | None:
    with connection() as conn:
        return conn.execute(
            "SELECT * FROM social_accounts WHERE user_id = %s AND platform = %s", (user_id, PLATFORM)
        ).fetchone()


def _delete_account(user_id) -> None:
    with connection() as conn:
        conn.execute("DELETE FROM social_accounts WHERE user_id = %s AND platform = %s", (user_id, PLATFORM))


def _public(row: dict | None) -> dict | None:
    if not row:
        return None
    return {
        "id": row["account_id"],
        "username": row["username"],
        **row["profile"],
        "connected_at": row["connected_at"].isoformat(),
        "expires_at": row["token_expires_at"].isoformat() if row["token_expires_at"] else None,
    }


def _token_for(user_id) -> tuple[dict, str]:
    """The account and a usable token, refreshing it when it is close to expiry."""
    row = _load_account(user_id)
    if not row:
        raise HTTPException(409, "Connect an Instagram account first.")
    try:
        token = _fernet().decrypt(row["access_token"].encode()).decode()
    except InvalidToken:
        _delete_account(user_id)
        raise HTTPException(401, "The saved Instagram sign-in can no longer be read. Connect the account again.") from None

    expires = row["token_expires_at"]
    now = datetime.now(UTC)
    if expires and expires <= now:
        _delete_account(user_id)
        raise HTTPException(401, "The Instagram sign-in expired. Connect the account again.")
    # Instagram only refreshes tokens that are at least a day old.
    if expires and expires - now < REFRESH_WITHIN and now - row["updated_at"] > timedelta(days=1):
        try:
            data = _graph("GET", f"{GRAPH}/refresh_access_token", params={"grant_type": "ig_refresh_token", "access_token": token})
            token = data["access_token"]
            with connection() as conn:
                conn.execute(
                    "UPDATE social_accounts SET access_token = %s, token_expires_at = %s, updated_at = now() WHERE user_id = %s AND platform = %s",
                    (_fernet().encrypt(token.encode()).decode(), now + timedelta(seconds=int(data.get("expires_in", 0)) or 5_184_000), user_id, PLATFORM),
                )
        except GraphError:
            pass  # the current token still works until it expires
    return row, token


# ---- connect --------------------------------------------------------------------------


@router.get("/status")
def status(user: dict = Depends(current_user)):
    missing = _missing_settings()
    return {
        "configured": not missing,
        "missing": missing,
        "account": _public(_load_account(user["id"])) if not missing else None,
    }


@router.get("/connect")
def connect_url(user: dict = Depends(current_user)):
    _require_configured()
    params = {
        "client_id": INSTAGRAM_APP_ID,
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": SCOPES,
        "state": _make_state(user["id"]),
        "enable_fb_login": "0",
        "force_authentication": "1",  # lets the creator pick which Instagram account to connect
    }
    return {"url": f"{AUTHORIZE_URL}?{urlencode(params)}"}


@router.get("/callback", include_in_schema=False)
def callback(code: str = "", state: str = "", error: str = "", error_description: str = ""):
    """Instagram's redirect target. Hands the code to the web app, which finishes the link."""
    if code:
        query = {"instagram_code": code.removesuffix("#_"), "state": state}
    else:
        query = {"instagram_error": error_description or error or "Instagram did not return a sign-in code."}
    return RedirectResponse(f"{APP_URL}/app/connections?{urlencode(query)}", status_code=303)


class FinishConnect(BaseModel):
    code: Annotated[str, StringConstraints(min_length=10, max_length=2048)]
    state: Annotated[str, StringConstraints(min_length=10, max_length=300)]


@router.post("/connect")
def finish_connect(body: FinishConnect, user: dict = Depends(current_user)):
    _require_configured()
    _check_state(body.state, user["id"])
    try:
        short = _graph(
            "POST",
            TOKEN_URL,
            data={
                "client_id": INSTAGRAM_APP_ID,
                "client_secret": INSTAGRAM_APP_SECRET,
                "grant_type": "authorization_code",
                "redirect_uri": _redirect_uri(),
                "code": body.code,
            },
        )
        short = (short.get("data") or [short])[0]
        granted = short.get("permissions") or ""
        if isinstance(granted, str):
            granted = granted.split(",")
        if granted and "instagram_business_content_publish" not in granted:
            raise HTTPException(403, "Aurea needs permission to publish content. Connect again and allow it.")
        long = _graph(
            "GET",
            f"{GRAPH}/access_token",
            params={"grant_type": "ig_exchange_token", "client_secret": INSTAGRAM_APP_SECRET, "access_token": short["access_token"]},
        )
        row = _save_account(user["id"], long["access_token"], int(long.get("expires_in", 0)) or None)
    except GraphError as exc:
        _fail(exc)
    return {"configured": True, "missing": [], "account": _public(row)}


@router.delete("/connect")
def disconnect(user: dict = Depends(current_user)):
    _delete_account(user["id"])
    return {"ok": True}


# ---- media staging --------------------------------------------------------------------


class MediaUpload(BaseModel):
    data: Annotated[str, StringConstraints(max_length=MAX_IMAGE_BYTES * 4 // 3 + 64, pattern=r"^data:image/jpeg;base64,[A-Za-z0-9+/=]+$")]


@router.post("/media")
def upload_media(body: MediaUpload, user: dict = Depends(current_user)):
    raw = base64.b64decode(body.data.split(",", 1)[1])
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Each image must be 8 MB or smaller.")
    if not raw.startswith(b"\xff\xd8\xff"):
        raise HTTPException(422, "Instagram only accepts JPEG images.")
    token = secrets.token_urlsafe(32)
    with connection() as conn:
        conn.execute(f"DELETE FROM publish_media WHERE created_at < now() - interval '{MEDIA_TTL}'")
        conn.execute("INSERT INTO publish_media (token, user_id, data) VALUES (%s, %s, %s)", (token, user["id"], raw))
    return {"token": token}


@router.get("/media/{token}.jpg", include_in_schema=False)
def serve_media(token: MediaToken):
    """Public on purpose: Instagram's servers fetch post images from here."""
    with connection() as conn:
        row = conn.execute(
            f"SELECT data FROM publish_media WHERE token = %s AND created_at > now() - interval '{MEDIA_TTL}'", (token,)
        ).fetchone()
    if not row:
        raise HTTPException(404)
    return Response(content=bytes(row["data"]), media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"})


# ---- publish --------------------------------------------------------------------------


class PublishRequest(BaseModel):
    media: list[MediaToken] = Field(min_length=1, max_length=MAX_CAROUSEL)
    caption: Annotated[str, StringConstraints(max_length=MAX_CAPTION)] = ""
    project_id: Annotated[str, StringConstraints(max_length=120)] = ""
    title: Annotated[str, StringConstraints(max_length=300)] = ""


def _wait_until_ready(container_ids: list[str], token: str) -> None:
    deadline = time.monotonic() + PROCESS_TIMEOUT
    pending = list(container_ids)
    while pending:
        still = []
        for cid in pending:
            code = _graph("GET", _api(cid), params={"fields": "status_code", "access_token": token}).get("status_code")
            if code in ("ERROR", "EXPIRED"):
                raise GraphError("Instagram could not process one of the images. Check its size and try again.")
            if code != "FINISHED":
                still.append(cid)
        pending = still
        if pending:
            if time.monotonic() > deadline:
                raise GraphError("Instagram is taking too long to process the images. Try again in a few minutes.")
            time.sleep(1.5)


@router.post("/publish")
def publish(body: PublishRequest, user: dict = Depends(current_user)):
    _require_configured()
    with connection() as conn:
        owned = conn.execute(
            "SELECT token FROM publish_media WHERE user_id = %s AND token = ANY(%s)", (user["id"], body.media)
        ).fetchall()
    if len({r["token"] for r in owned}) != len(set(body.media)):
        raise HTTPException(404, "Some images expired before publishing. Try again.")

    account, token = _token_for(user["id"])
    ig_user = account["account_id"]
    urls = [f"{PUBLIC_API_URL}/api/instagram/media/{t}.jpg" for t in body.media]
    try:
        if len(urls) == 1:
            container = _graph("POST", _api(f"{ig_user}/media"), data={"image_url": urls[0], "caption": body.caption, "access_token": token})["id"]
            _wait_until_ready([container], token)
        else:
            children = [
                _graph("POST", _api(f"{ig_user}/media"), data={"image_url": url, "is_carousel_item": "true", "access_token": token})["id"]
                for url in urls
            ]
            _wait_until_ready(children, token)
            container = _graph(
                "POST",
                _api(f"{ig_user}/media"),
                data={"media_type": "CAROUSEL", "children": ",".join(children), "caption": body.caption, "access_token": token},
            )["id"]
            _wait_until_ready([container], token)
        media_id = _graph("POST", _api(f"{ig_user}/media_publish"), data={"creation_id": container, "access_token": token})["id"]
        try:
            permalink = _graph("GET", _api(media_id), params={"fields": "permalink", "access_token": token}).get("permalink", "")
        except GraphError:
            permalink = ""
    except GraphError as exc:
        _fail(exc, user["id"])
    finally:
        with connection() as conn:
            conn.execute("DELETE FROM publish_media WHERE user_id = %s AND token = ANY(%s)", (user["id"], body.media))

    posted_at = datetime.now(UTC).isoformat()
    try:  # log it on Insights so results can be filled in later
        metric = _validate("metric", {"platform": PLATFORM, "posted_at": posted_at, "title": body.title, "url": permalink, "project_id": body.project_id})
        _upsert_many(user["id"], "metric", [(uuid.uuid4().hex, metric)])
    except HTTPException:
        pass
    return {"id": media_id, "permalink": permalink, "username": account["username"], "posted_at": posted_at}
