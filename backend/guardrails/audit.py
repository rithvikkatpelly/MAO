"""Audit log of AI calls and guardrail decisions. Stores sizes, hashes, timings and verdicts,
never the prompt or the output text, so the log holds no personal content."""

import hashlib
import logging

from psycopg.types.json import Jsonb

from guardrails import runctx

log = logging.getLogger("aurea.audit")


def record(
    *,
    kind: str,
    outcome: str,
    model: str = "",
    prompt: str = "",
    prompt_tokens: int = 0,
    output_tokens: int = 0,
    latency_ms: int = 0,
    detail: dict | None = None,
    user_id=None,
    endpoint: str = "",
) -> None:
    ctx = runctx.current()
    user_id = user_id or (ctx.user_id if ctx else None)
    endpoint = endpoint or (ctx.endpoint if ctx else "")
    try:
        from db import connection

        with connection() as conn:
            conn.execute(
                """
                INSERT INTO ai_audit (user_id, endpoint, kind, outcome, model, prompt_sha256, prompt_tokens, output_tokens, latency_ms, detail)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user_id,
                    endpoint[:80],
                    kind[:40],
                    outcome[:40],
                    model[:60],
                    hashlib.sha256(prompt.encode()).hexdigest() if prompt else "",
                    prompt_tokens,
                    output_tokens,
                    latency_ms,
                    Jsonb(detail or {}),
                ),
            )
    except Exception:
        log.debug("audit write skipped", exc_info=True)
