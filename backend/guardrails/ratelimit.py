"""Short-window rate limits (per minute), in memory. Daily quotas live in quota.py."""

import threading
import time
from collections import defaultdict, deque

from guardrails import config
from guardrails.errors import GuardrailViolation

_WINDOW = 60.0
_hits: dict[tuple[str, str], deque] = defaultdict(deque)
_lock = threading.Lock()


def hit(key, bucket: str) -> None:
    limit = config.PER_MINUTE.get(bucket)
    if not limit:
        return
    now = time.monotonic()
    with _lock:
        q = _hits[(str(key), bucket)]
        while q and now - q[0] > _WINDOW:
            q.popleft()
        if len(q) >= limit:
            wait = int(_WINDOW - (now - q[0])) + 1
            raise GuardrailViolation(429, f"Too many requests. Wait {wait} seconds and try again.", "rate_limit")
        q.append(now)
        if len(_hits) > 50_000:  # forget idle keys
            for k in [k for k, v in _hits.items() if not v or now - v[-1] > _WINDOW]:
                del _hits[k]
