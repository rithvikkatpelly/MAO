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
from guardrails import flags, quota, ratelimit
from guardrails.errors import GuardrailViolation, public_error
from guardrails.gate import GATE
from guardrails.runctx import run_context
from guardrails.semantic import screen
from guardrails.untrusted import fence
from guardrails.validators import check_instruction, check_profile_text

router = APIRouter(prefix="/api/trends", tags=["trends"])
log = logging.getLogger("aurea.trends")

INTERVALS = {"daily": timedelta(days=1), "weekly": timedelta(days=7)}
CHECK_EVERY_SECONDS = 300
MANUAL_WAIT_SECONDS = 60


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


def _now() -> str:
    return datetime.now(UTC).isoformat()


def run_trend(user_id) -> list[dict]:
    """Research the niche and add ideas to the backlog. The caller holds a model slot.

    Always records last_run_at, success or not, so a failing creator is retried on the
    normal schedule instead of every few minutes."""
    from agents.orchestrator import IdeaList  # heavy import, only needed here
    from llm import invoke_structured
    from text_rules import STYLE_RULE, clean

    row = _load(user_id)
    try:
        topic = check_instruction(_topic(row), "trend topic", classifier=False)
        if not topic:
            raise GuardrailViolation(400, "Add your niche in the brand kit, or a topic for trend watch, first.", "no_topic")
        with run_context(user_id, "trends.run", max_calls=4):
            screen(topic, "trend topic")
            sources = top_sources(f"{topic} latest news")
            profile = brand_profile_for(user_id) or {}
            voice = profile.get("voice", {})
            covered = "; ".join(p["title"] for p in profile.get("recent_posts", [])[:12])
            ideas = invoke_structured(
                IdeaList,
                f"Niche: {topic}\n"
                + fence("creator_profile", f"Tone: {voice.get('tone', '')}. Audience: {voice.get('audience', '')}.")
                + f"\n\nWhat is happening now:\n{format_sources(sources)}\n\n"
                "Propose 3 to 5 timely post ideas this creator could publish this week, grounded in these sources.\n"
                + (f"They already posted these, do not repeat them:\n{fence('past_titles', covered)}\n" if covered else "")
                + STYLE_RULE,
                temperature=0.6,
                max_tokens=800,
            )
        items = [
            (uuid.uuid4().hex, {**clean(i.model_dump()), "topic": topic, "source": "trend", "status": "new", "planned_for": "", "kind": "", "series_id": ""})
            for i in ideas.ideas
        ]
        saved = _upsert_many(user_id, "idea", items)
    except Exception as exc:
        message = public_error(exc, "Trend research")
        _save_status(user_id, last_run_at=_now(), last_status=f"failed: {message}"[:200])
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(502, message) from None
    _save_status(user_id, last_run_at=_now(), last_status=f"added {len(saved)} ideas")
    return saved


@router.get("/settings")
def get_settings(user: dict = Depends(current_user)):
    row = _load(user["id"])
    return {**TrendSettings().model_dump(), **(row["trend"] or {}), "default_topic": _topic({**row, "trend": {}})}


@router.put("/settings")
def put_settings(body: TrendSettings, user: dict = Depends(current_user)):
    fields = body.model_dump()
    fields["topic"] = check_profile_text(body.topic, "trend topic")
    _save_status(user["id"], **fields)
    return get_settings(user)


@router.post("/run")
def run_now(user: dict = Depends(current_user)):
    user_id = str(user["id"])
    flags.require("ai")
    ratelimit.hit(user_id, "trend")
    if not GATE.claim_user(user_id):
        raise GuardrailViolation(429, "You already have a generation running. Try again when it finishes.", "busy")
    try:
        charge = quota.consume(user_id, "trend")
        try:
            if not GATE.acquire_slot(MANUAL_WAIT_SECONDS):
                raise GuardrailViolation(503, "The AI engine is busy. Try again in a few minutes.", "queue_timeout")
            try:
                return {"ideas": run_trend(user_id)}
            finally:
                GATE.release_slot()
        except BaseException:
            charge.refund()
            raise
    finally:
        GATE.release_user(user_id)


# ---- scheduler -----------------------------------------------------------------------


def _due_users() -> list:
    """Every creator whose run is due, the longest-waiting first."""
    with connection() as conn:
        rows = conn.execute(
            """
            SELECT user_id, trend FROM profiles WHERE (trend->>'enabled')::boolean IS TRUE
            ORDER BY (trend->>'last_run_at') NULLS FIRST
            """
        ).fetchall()
    now = datetime.now(UTC)
    due = []
    for r in rows:
        last = r["trend"].get("last_run_at")
        interval = INTERVALS.get(r["trend"].get("frequency", "weekly"), INTERVALS["weekly"])
        try:
            if not last or datetime.fromisoformat(last) + interval <= now:
                due.append(r["user_id"])
        except ValueError:
            due.append(r["user_id"])
    return due


def _loop(stop: threading.Event) -> None:
    while not stop.wait(CHECK_EVERY_SECONDS):
        try:
            if not flags.enabled("ai"):
                continue
            for user_id in _due_users():
                if stop.is_set() or GATE.busy():
                    break  # creators come first; the rest wait for the next check
                if not GATE.claim_user(user_id):
                    continue
                try:
                    if GATE.acquire_slot(1):
                        try:
                            run_trend(user_id)
                        except Exception:
                            log.info("trend watch run failed for a creator; recorded on their profile")
                        finally:
                            GATE.release_slot()
                finally:
                    GATE.release_user(user_id)
        except Exception:
            log.exception("trend watch check failed")


_stop = threading.Event()


def start_scheduler() -> None:
    _stop.clear()
    threading.Thread(target=_loop, args=(_stop,), daemon=True, name="trend-watch").start()


def stop_scheduler() -> None:
    _stop.set()
