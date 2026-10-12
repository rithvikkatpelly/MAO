"""Guardrail limits. Every value can be overridden in backend/.env (see .env.example)."""

import os

import settings  # noqa: F401  loads backend/.env before the values below are read


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)).strip())
    except ValueError:
        return default


def _list(name: str, default: str = "") -> list[str]:
    return [v.strip().lower() for v in os.getenv(name, default).split(",") if v.strip()]


# ---- daily quotas (reset at midnight UTC) --------------------------------------------
# "design" is one finished carousel, poster, image, thumbnail, deck, or infographic.
DAILY_LIMITS = {
    "design": _int("DESIGNS_PER_DAY", 5),
    "research": _int("RESEARCH_RUNS_PER_DAY", 20),
    "assist": _int("AI_ASSISTS_PER_DAY", 100),
    "chat": _int("CHAT_MESSAGES_PER_DAY", 50),
    "trend": _int("TREND_RUNS_PER_DAY", 5),
    "upload": _int("UPLOADS_PER_DAY", 60),
    "publish": _int("PUBLISHES_PER_DAY", 10),
}
BUCKET_LABELS = {
    "design": "designs",
    "research": "research runs",
    "assist": "AI edits",
    "chat": "chat messages",
    "trend": "trend watch runs",
    "upload": "image uploads",
    "publish": "posts",
}

# ---- short-window rate limits (requests per minute) -----------------------------------
PER_MINUTE = {
    "design": 3,
    "research": 4,
    "assist": 15,
    "chat": 10,
    "trend": 2,
    "upload": 30,
    "publish": 3,
    "auth": 10,  # per client address
    "export": 2,
}

# ---- context window ----------------------------------------------------------------------
# How much conversation history is kept. Past this, the oldest messages are removed.
CONTEXT_WINDOW_TOKENS = _int("CONTEXT_WINDOW_TOKENS", 200_000)
# What the local model actually reads per call (Ollama num_ctx). Prompts are fitted to this
# so Ollama never silently cuts the start of a prompt, which is where the safety rules live.
LLM_NUM_CTX = _int("LLM_NUM_CTX", 8192)
# Conservative characters per token for estimates (English averages about 4).
CHARS_PER_TOKEN = 3.5

# ---- model calls ---------------------------------------------------------------------------
LLM_TIMEOUT_SECONDS = _int("LLM_TIMEOUT_SECONDS", 180)
MAX_MODEL_CALLS_PER_RUN = _int("MAX_MODEL_CALLS_PER_RUN", 24)
RUN_DEADLINE_SECONDS = _int("RUN_DEADLINE_SECONDS", 900)
MODEL_CONCURRENCY = max(1, _int("MODEL_CONCURRENCY", 1))
QUEUE_TIMEOUT_SECONDS = _int("QUEUE_TIMEOUT_SECONDS", 600)
ASSISTS_IN_FLIGHT_PER_USER = max(1, _int("ASSISTS_IN_FLIGHT_PER_USER", 2))
PUBLISHES_IN_FLIGHT = max(1, _int("PUBLISHES_IN_FLIGHT", 4))
# Optional local safety classifier, for example llama-guard3:1b (ollama pull llama-guard3:1b).
GUARD_MODEL = os.getenv("GUARD_MODEL", "").strip()

# ---- requests ---------------------------------------------------------------------------------
MAX_BODY_BYTES = _int("MAX_BODY_BYTES", 10 * 1024 * 1024)
MAX_STAGED_MEDIA_PER_USER = _int("MAX_STAGED_MEDIA_PER_USER", 20)

# ---- web sources --------------------------------------------------------------------------------
BLOCKED_SOURCE_DOMAINS = _list("BLOCKED_SOURCE_DOMAINS", "pastebin.com,4chan.org,8kun.top,kiwifarms.net")
PREFERRED_SOURCE_DOMAINS = _list(
    "PREFERRED_SOURCE_DOMAINS",
    "reuters.com,apnews.com,bbc.com,nature.com,who.int,nih.gov,hbr.org,mckinsey.com,pewresearch.org,statista.com",
)

# ---- retention (days) -----------------------------------------------------------------------------
PIPELINE_RETENTION_DAYS = _int("PIPELINE_RETENTION_DAYS", 7)
CHAT_RETENTION_DAYS = _int("CHAT_RETENTION_DAYS", 30)
AUDIT_RETENTION_DAYS = _int("AUDIT_RETENTION_DAYS", 90)

# ---- semantic input validation ------------------------------------------------------------
# A model judges what each request means before any research or generation runs, catching
# harmful requests that keyword rules miss ("best way to poison someone without getting caught").
SEMANTIC_GUARD = os.getenv("SEMANTIC_GUARD", "true").strip().lower() not in ("0", "false", "no", "off")
SEMANTIC_GUARD_MODEL = os.getenv("SEMANTIC_GUARD_MODEL", "qwen3:8b").strip()
# When the classifier cannot run: false refuses the request (safe), true lets it through.
SEMANTIC_GUARD_FAIL_OPEN = os.getenv("SEMANTIC_GUARD_FAIL_OPEN", "false").strip().lower() in ("1", "true", "yes", "on")
