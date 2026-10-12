"""Kill switches that work without a redeploy or restart.

    uv run python -m guardrails.flags                 # show
    uv run python -m guardrails.flags ai off          # stop every AI feature
    uv run python -m guardrails.flags publishing on   # resume Instagram publishing

Flags live in Postgres (app_flags) and are re-read every 10 seconds. AI_ENABLED=false or
PUBLISHING_ENABLED=false in the environment also turns a feature off.
"""

import os
import sys
import threading
import time

from guardrails.errors import GuardrailViolation

FLAGS = {
    "ai": "AI features are paused by the administrator. Please try again later.",
    "publishing": "Publishing is paused by the administrator. Your post is saved; try again later.",
}
_cache: dict[str, bool] = {}
_loaded_at = 0.0
_lock = threading.Lock()


def _env_off(name: str) -> bool:
    return os.getenv(f"{name.upper()}_ENABLED", "true").strip().lower() in ("0", "false", "no", "off")


def _load() -> dict[str, bool]:
    global _cache, _loaded_at
    with _lock:
        if time.monotonic() - _loaded_at < 10:
            return _cache
        try:
            from db import connection

            with connection() as conn:
                rows = conn.execute("SELECT name, enabled FROM app_flags").fetchall()
            _cache = {r["name"]: r["enabled"] for r in rows}
        except Exception:
            pass  # keep the last known values
        _loaded_at = time.monotonic()
        return _cache


def enabled(name: str) -> bool:
    if _env_off(name):
        return False
    return _load().get(name, True)


def require(name: str) -> None:
    if not enabled(name):
        raise GuardrailViolation(503, FLAGS[name], "disabled")


def set_flag(name: str, value: bool) -> None:
    from db import connection

    with connection() as conn:
        conn.execute(
            "INSERT INTO app_flags (name, enabled) VALUES (%s, %s) ON CONFLICT (name) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()",
            (name, value),
        )


if __name__ == "__main__":
    from db import init_db

    init_db()
    args = sys.argv[1:]
    if len(args) == 2 and args[0] in FLAGS and args[1] in ("on", "off"):
        set_flag(args[0], args[1] == "on")
        _loaded_at = 0.0
    elif args:
        sys.exit(f"usage: python -m guardrails.flags [{'|'.join(FLAGS)}] [on|off]")
    for name in FLAGS:
        print(f"{name}: {'on' if enabled(name) else 'off'}")
