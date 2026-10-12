"""Daily per-user quotas, stored in Postgres so they survive restarts. Days are UTC.

consume() charges before work starts and returns a Charge; call refund() if the work fails or
is cancelled, so creators only pay for designs they actually got.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from db import connection
from guardrails import config
from guardrails.errors import GuardrailViolation


def _today():
    return datetime.now(UTC).date()


def _resets_at() -> str:
    tomorrow = datetime.combine(_today() + timedelta(days=1), datetime.min.time(), tzinfo=UTC)
    return tomorrow.isoformat()


@dataclass
class Charge:
    user_id: str
    bucket: str
    day: object
    amount: int
    refunded: bool = False

    def refund(self) -> None:
        if self.refunded or not self.amount:
            return
        self.refunded = True
        try:
            with connection() as conn:
                conn.execute(
                    "UPDATE usage_counters SET used = GREATEST(used - %s, 0) WHERE user_id = %s AND bucket = %s AND day = %s",
                    (self.amount, self.user_id, self.bucket, self.day),
                )
        except Exception:
            pass  # a lost refund is better than a failed request


def consume(user_id, bucket: str, amount: int = 1) -> Charge:
    limit = config.DAILY_LIMITS[bucket]
    label = config.BUCKET_LABELS[bucket]
    day = _today()
    if amount > limit:
        raise GuardrailViolation(429, f"That needs {amount} {label}, more than the daily limit of {limit}.", "quota")
    with connection() as conn:
        row = conn.execute(
            """
            INSERT INTO usage_counters (user_id, bucket, day, used) VALUES (%(u)s, %(b)s, %(d)s, %(n)s)
            ON CONFLICT (user_id, bucket, day) DO UPDATE SET used = usage_counters.used + EXCLUDED.used
                WHERE usage_counters.used + EXCLUDED.used <= %(limit)s
            RETURNING used
            """,
            {"u": user_id, "b": bucket, "d": day, "n": amount, "limit": limit},
        ).fetchone()
    if not row:
        raise GuardrailViolation(
            429,
            f"You have used all {limit} {label} for today. The limit resets at midnight UTC.",
            "quota",
        )
    return Charge(str(user_id), bucket, day, amount)


def usage_for(user_id) -> dict:
    with connection() as conn:
        rows = conn.execute(
            "SELECT bucket, used FROM usage_counters WHERE user_id = %s AND day = %s", (user_id, _today())
        ).fetchall()
    used = {r["bucket"]: r["used"] for r in rows}
    return {
        "resets_at": _resets_at(),
        "buckets": {
            b: {"used": used.get(b, 0), "limit": limit, "left": max(limit - used.get(b, 0), 0), "label": config.BUCKET_LABELS[b]}
            for b, limit in config.DAILY_LIMITS.items()
        },
    }
