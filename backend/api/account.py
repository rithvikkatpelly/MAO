"""The creator's account: today's AI usage, a full data export, and account deletion."""

import json
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from api.auth import clear_session_cookie, current_user
from db import connection
from guardrails import config, quota, ratelimit
from guardrails.maintenance import purge_pipeline_threads

router = APIRouter(prefix="/api/account", tags=["account"])


@router.get("/usage")
def usage(user: dict = Depends(current_user)):
    return {**quota.usage_for(user["id"]), "context_window_tokens": config.CONTEXT_WINDOW_TOKENS}


def _rows(conn, sql: str, user_id) -> list[dict]:
    return [dict(r) for r in conn.execute(sql, (user_id,)).fetchall()]


@router.get("/export")
def export(user: dict = Depends(current_user)):
    """Everything Aurea stores about the creator, as one JSON file. Connected account tokens
    are left out: they are credentials, not the creator's data."""
    ratelimit.hit(user["id"], "export")
    uid = user["id"]
    with connection() as conn:
        data = {
            "exported_at": datetime.now(UTC).isoformat(),
            "user": _rows(conn, "SELECT id, email, name, picture_url, created_at, last_login_at FROM users WHERE id = %s", uid),
            "profile": _rows(conn, "SELECT brand, social, trend, onboarded_at, updated_at FROM profiles WHERE user_id = %s", uid),
            "projects": _rows(conn, "SELECT id, title, kind, data, created_at, updated_at FROM projects WHERE user_id = %s", uid),
            "project_versions": _rows(conn, "SELECT project_id, reason, label, data, created_at FROM project_versions WHERE user_id = %s", uid),
            "items": _rows(conn, "SELECT kind, id, data, created_at, updated_at FROM user_items WHERE user_id = %s", uid),
            "connected_accounts": _rows(conn, "SELECT platform, account_id, username, profile, connected_at FROM social_accounts WHERE user_id = %s", uid),
            "chat_conversations": _rows(conn, "SELECT id, title, created_at, updated_at FROM chat_conversations WHERE user_id = %s", uid),
            "chat_messages": _rows(conn, "SELECT conversation_id, role, content, created_at FROM chat_messages WHERE user_id = %s ORDER BY id", uid),
            "usage": _rows(conn, "SELECT bucket, day, used FROM usage_counters WHERE user_id = %s", uid),
            "published": _rows(conn, "SELECT request_id, status, result, created_at FROM publish_log WHERE user_id = %s", uid),
        }
    body = json.dumps(data, default=str, indent=2)
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="aurea-export.json"', "Cache-Control": "no-store"},
    )


class DeleteAccount(BaseModel):
    confirm: Literal["DELETE"]


@router.delete("")
def delete_account(body: DeleteAccount, response: Response, user: dict = Depends(current_user)):
    """Deletes the account and everything stored with it. Cannot be undone."""
    purge_pipeline_threads(user_id=user["id"])
    with connection() as conn:
        conn.execute("DELETE FROM users WHERE id = %s", (user["id"],))  # every other table cascades
    clear_session_cookie(response)
    return {"ok": True}
