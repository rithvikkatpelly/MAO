"""Admission and streaming for AI work.

admit()        before any work: kill switch, per-minute rate limit, one generation per creator,
               then the daily quota. Failing any of these is a normal HTTP error (429/503).
stream_job()   runs the job on a worker thread after it gets a fair turn on the model, inside a
               per-run budget, and streams SSE events. The quota is refunded if the job fails or
               the creator cancels.
assist()       the same checks for quick, single-call AI edits.
"""

import json
import queue
import threading
from collections.abc import AsyncIterator, Callable
from contextlib import contextmanager
from dataclasses import dataclass

from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

from guardrails import config, flags, quota, ratelimit
from guardrails.errors import GuardrailViolation, public_error
from guardrails.gate import ASSISTS, GATE
from guardrails.runctx import run_context

SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
_END = object()


class Cancelled(Exception):
    pass


@dataclass
class Admission:
    user_id: str
    bucket: str
    endpoint: str
    charge: quota.Charge | None
    exclusive: bool

    def refund(self) -> None:
        if self.charge:
            self.charge.refund()

    def release(self) -> None:
        if self.exclusive:
            GATE.release_user(self.user_id)


def admit(user_id, bucket: str, endpoint: str, *, exclusive: bool = True, charge: bool = True) -> Admission:
    user_id = str(user_id)
    flags.require("ai")
    ratelimit.hit(user_id, bucket)
    if exclusive and not GATE.claim_user(user_id):
        raise GuardrailViolation(429, "You already have a generation running. Wait for it to finish or cancel it, then try again.", "busy")
    try:
        spent = quota.consume(user_id, bucket) if charge else None
    except BaseException:
        if exclusive:
            GATE.release_user(user_id)
        raise
    return Admission(user_id, bucket, endpoint, spent, exclusive)


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


Emit = Callable[..., None]


def _worker(job: Callable[[Emit, threading.Event], dict], admission: Admission, out: queue.Queue, cancelled: threading.Event) -> None:
    succeeded = False

    def emit(node: str, status: str, detail: str = "") -> None:
        if cancelled.is_set():
            raise Cancelled()
        out.put({"type": "step", "node": node, "status": status, **({"detail": detail} if detail else {})})

    try:
        waited = GATE.acquire_slot(
            config.QUEUE_TIMEOUT_SECONDS,
            on_wait=lambda pos: out.put({"type": "step", "node": "queue", "status": "running", "detail": f"Waiting for the AI engine, {pos} in line"}),
            cancelled=cancelled,
        )
        if not waited:
            if cancelled.is_set():
                raise Cancelled()
            raise GuardrailViolation(503, "The AI engine is busy. Try again in a few minutes.", "queue_timeout")
        try:
            with run_context(admission.user_id, admission.endpoint) as ctx:
                result = job(emit, cancelled)
                if cancelled.is_set():
                    raise Cancelled()
                if ctx.warnings:
                    result["warnings"] = list(dict.fromkeys([*result.get("warnings", []), *ctx.warnings]))
        finally:
            GATE.release_slot()
        out.put({"type": "result", "data": result})
        succeeded = True
    except Cancelled:
        pass
    except Exception as exc:
        out.put({"type": "error", "message": public_error(exc, "Generation")})
    finally:
        if not succeeded:
            admission.refund()
        admission.release()
        out.put(_END)


def stream_job(job: Callable[[Emit, threading.Event], dict], admission: Admission) -> StreamingResponse:
    out: queue.Queue = queue.Queue()
    cancelled = threading.Event()
    try:
        threading.Thread(target=_worker, args=(job, admission, out, cancelled), daemon=True).start()
    except BaseException:
        admission.refund()
        admission.release()
        raise

    async def events() -> AsyncIterator[str]:
        try:
            while True:
                item = await run_in_threadpool(out.get)
                if item is _END:
                    break
                yield _sse(item)
        finally:
            cancelled.set()  # the client went away: the worker stops before its next step

    return StreamingResponse(events(), media_type="text/event-stream", headers=SSE_HEADERS)


@contextmanager
def assist(user_id, endpoint: str, *, bucket: str = "assist", max_calls: int = 4):
    """Quick AI edits: kill switch, rate limit, per-creator concurrency, quota (refunded on
    failure), a small call budget, and safe error messages."""
    user_id = str(user_id)
    flags.require("ai")
    ratelimit.hit(user_id, bucket)
    with ASSISTS.hold(user_id):
        charge = quota.consume(user_id, bucket)
        ok = False
        try:
            with run_context(user_id, endpoint, max_calls=max_calls, seconds=config.LLM_TIMEOUT_SECONDS * 2) as ctx:
                yield ctx
            ok = True
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(502, public_error(exc, "The AI edit")) from None
        finally:
            if not ok:
                charge.refund()
