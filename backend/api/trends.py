"""Trend watch: a scheduled research run on the creator's niche.

Each run searches current news for the niche, asks the model for post ideas,
and adds them to the ideas backlog (source "trend"). A background thread checks
every few minutes for creators whose run is due; "Run now" does it on demand.
"""

import logging
import threading
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from psycopg.types.json import Jsonb
from pydantic import BaseModel, StringConstraints

from agents._web import format_sources, top_sources
from api.auth import current_user
from api.items import _upsert_many
from api.profile import brand_profile_for
from db import connection
from runtime import pipeline_lock

router = APIRouter(prefix="/api/trends", tags=["trends"])
log = logging.getLogger("aurea.trends")

INTERVALS = {"daily": timedelta(days=1), "weekly": timedelta(days=7)}
CHECK_EVERY_SECONDS = 300


class TrendSettings(BaseModel):
    enabled: bool = False
    frequency: Literal["daily", "weekly"] = "weekly"
    topic: Annotated[str, StringConstraints(max_length=200)] = ""


def _load(user_id) -> dict:
    with connection() as conn:
        row = conn.execute("SELECT trend, social FROM profiles WHERE user_id = %s", (user_id,)).fetchone()
    return row or {"trend": {}, "social": {}}


def _topic(row: dict) -> str:
    trend, social = row["trend"] or {}, row["social"] or {}
    return trend.get("topic") or social.get("niche") or ", ".join(social.get("content_types", [])[:2])


def _save_status(user_id, **fields) -> None:
    with connection() as conn:
        conn.execute(
            "UPDATE profiles SET trend = trend || %s WHERE user_id = %s", (Jsonb(fields), user_id)
        )


def run_trend(user_id) -> list[dict]:
    """Research the niche and add ideas to the backlog. Caller must hold pipeline_lock."""
    from agents.orchestrator import IdeaList  # heavy import, only needed here
    from llm import invoke_structured
    from text_rules import STYLE_RULE, clean

    row = _load(user_id)
    topic = _topic(row)
    if not topic:
        _save_status(user_id, last_run_at=datetime.now(UTC).isoformat(), last_status="no niche or topic set")
        raise HTTPException(400, "Add your niche in the brand kit, or a topic for trend watch, first.")
    try:
        sources = top_sources(f"{topic} latest news")
        profile = brand_profile_for(user_id) or {}
        voice = profile.get("voice", {})
        covered = "; ".join(p["title"] for p in profile.get("recent_posts", [])[:12])
        ideas = invoke_structured(
            IdeaList,
            f"Niche: {topic}\nTone: {voice.get('tone', '')}. Audience: {voice.get('audience', '')}.\n\n"
            f"What is happening now:\n{format_sources(sources)}\n\n"
            "Propose 3 to 5 timely post ideas this creator could publish this week, grounded in these sources.\n"
            + (f"They already posted: {covered}. Do not repeat those.\n" if covered else "")
            + STYLE_RULE,
            temperature=0.6,
            max_tokens=800,
        )
    except HTTPException:
        raise
    except Exception as exc:
        _save_status(user_id, last_run_at=datetime.now(UTC).isoformat(), last_status=f"failed: {exc}"[:200])
        raise HTTPException(502, f"Trend research failed: {exc}") from None

    items = [
        (uuid.uuid4().hex, {**clean(i.model_dump()), "topic": topic, "source": "trend", "status": "new", "planned_for": "", "kind": "", "series_id": ""})
        for i in ideas.ideas
    ]
    saved = _upsert_many(user_id, "idea", items)
    _save_status(user_id, last_run_at=datetime.now(UTC).isoformat(), last_status=f"added {len(saved)} ideas")
    return saved


@router.get("/settings")
def get_settings(user: dict = Depends(current_user)):
    row = _load(user["id"])
    return {**TrendSettings().model_dump(), **(row["trend"] or {}), "default_topic": _topic({**row, "trend": {}})}


@router.put("/settings")
def put_settings(body: TrendSettings, user: dict = Depends(current_user)):
    _save_status(user["id"], **body.model_dump())
    return get_settings(user)


@router.post("/run")
def run_now(user: dict = Depends(current_user)):
    if not pipeline_lock.acquire(blocking=False):
        raise HTTPException(409, "A generation is running. Try again when it finishes.")
    try:
        return {"ideas": run_trend(user["id"])}
    finally:
        pipeline_lock.release()


# ---- scheduler -----------------------------------------------------------------------


def _due_user():
    with connection() as conn:
        rows = conn.execute(
            "SELECT user_id, trend FROM profiles WHERE (trend->>'enabled')::boolean IS TRUE"
        ).fetchall()
    now = datetime.now(UTC)
    for r in rows:
        last = r["trend"].get("last_run_at")
        interval = INTERVALS.get(r["trend"].get("frequency", "weekly"), INTERVALS["weekly"])
        if not last or datetime.fromisoformat(last) + interval <= now:
            return r["user_id"]
    return None


def _loop(stop: threading.Event) -> None:
    while not stop.wait(CHECK_EVERY_SECONDS):
        try:
            user_id = _due_user()
            if user_id and pipeline_lock.acquire(blocking=False):
                try:
                    run_trend(user_id)
                finally:
                    pipeline_lock.release()
        except Exception:
            log.exception("trend watch run failed")


_stop = threading.Event()


def start_scheduler() -> None:
    _stop.clear()
    threading.Thread(target=_loop, args=(_stop,), daemon=True, name="trend-watch").start()


def stop_scheduler() -> None:
    _stop.set()
