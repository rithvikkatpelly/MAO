"""Per-run limits and notes: how many model calls a run may make, how long it may take,
and warnings collected along the way (returned with the result so the editor can show them).

The context is set in the worker thread and LangGraph copies it into every node, including
parallel ones.
"""

import time
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field

from guardrails import config
from guardrails.errors import GuardrailViolation


@dataclass
class RunContext:
    user_id: str | None
    endpoint: str
    max_calls: int
    deadline: float
    calls: int = 0
    warnings: list[str] = field(default_factory=list)


_current: ContextVar[RunContext | None] = ContextVar("aurea_run", default=None)


@contextmanager
def run_context(user_id, endpoint: str, *, max_calls: int | None = None, seconds: int | None = None):
    ctx = RunContext(
        user_id=str(user_id) if user_id else None,
        endpoint=endpoint,
        max_calls=max_calls or config.MAX_MODEL_CALLS_PER_RUN,
        deadline=time.monotonic() + (seconds or config.RUN_DEADLINE_SECONDS),
    )
    token = _current.set(ctx)
    try:
        yield ctx
    finally:
        _current.reset(token)


def current() -> RunContext | None:
    return _current.get()


def warn(message: str) -> None:
    ctx = _current.get()
    if ctx is not None and message not in ctx.warnings:
        ctx.warnings.append(message)


def charge_model_call() -> None:
    """Called before every model call. Stops runaway runs."""
    ctx = _current.get()
    if ctx is None:
        return
    if time.monotonic() > ctx.deadline:
        raise GuardrailViolation(504, "This generation took too long and was stopped. Try a shorter request.", "deadline")
    if ctx.calls >= ctx.max_calls:
        raise GuardrailViolation(503, "This generation reached its safety limit of AI steps and was stopped.", "call_budget")
    ctx.calls += 1
