"""Retention: an hourly cleanup of data that should not live forever."""

import logging
import threading

from db import connection
from guardrails import config

log = logging.getLogger("aurea.maintenance")
_stop = threading.Event()
EVERY_SECONDS = 3600


def purge_pipeline_threads(older_than_days: int | None = None, user_id=None) -> int:
    """Delete saved LangGraph runs (drafts, brand profile snapshots) from the local session store."""
    from agents.orchestrator import aurea_graph

    days = config.PIPELINE_RETENTION_DAYS if older_than_days is None else older_than_days
    with connection() as conn:
        if user_id is not None:
            rows = conn.execute("SELECT thread_id FROM pipeline_threads WHERE user_id = %s", (user_id,)).fetchall()
        else:
            rows = conn.execute(
                "SELECT thread_id FROM pipeline_threads WHERE created_at < now() - make_interval(days => %s)", (days,)
            ).fetchall()
    ids = [r["thread_id"] for r in rows]
    for thread_id in ids:
        try:
            aurea_graph.checkpointer.delete_thread(thread_id)
        except Exception:
            log.warning("could not delete pipeline thread %s", thread_id, exc_info=True)
    if ids:
        with connection() as conn:
            conn.execute("DELETE FROM pipeline_threads WHERE thread_id = ANY(%s)", (ids,))
    return len(ids)


def run_once() -> None:
    with connection() as conn:
        conn.execute("DELETE FROM sessions WHERE expires_at < now()")
        conn.execute("DELETE FROM publish_media WHERE created_at < now() - interval '1 day'")
        conn.execute("DELETE FROM oauth_nonces WHERE expires_at < now()")
        conn.execute("DELETE FROM usage_counters WHERE day < (now() AT TIME ZONE 'utc')::date - 60")
        conn.execute("DELETE FROM chat_messages WHERE created_at < now() - make_interval(days => %s)", (config.CHAT_RETENTION_DAYS,))
        conn.execute(
            "DELETE FROM chat_conversations c WHERE updated_at < now() - make_interval(days => %s)", (config.CHAT_RETENTION_DAYS,)
        )
        conn.execute("DELETE FROM ai_audit WHERE created_at < now() - make_interval(days => %s)", (config.AUDIT_RETENTION_DAYS,))
        conn.execute("DELETE FROM publish_log WHERE created_at < now() - interval '180 days'")
    purge_pipeline_threads()


def _loop() -> None:
    while not _stop.wait(EVERY_SECONDS):
        try:
            run_once()
        except Exception:
            log.exception("maintenance run failed")


def start() -> None:
    _stop.clear()
    threading.Thread(target=_loop, daemon=True, name="maintenance").start()


def stop() -> None:
    _stop.set()
