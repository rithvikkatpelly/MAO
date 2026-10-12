"""Fair access to the local model.

  - Each creator can have one generation running at a time (others get a clear message).
  - Generations take the model in arrival order, MODEL_CONCURRENCY at a time, so one busy
    creator cannot starve everyone else the way a single global lock did.
  - Quick AI edits are limited per creator instead (ASSISTS_IN_FLIGHT_PER_USER at once).
Claims expire, so a crashed request can never lock a creator out for good.
"""

import threading
import time
from collections import deque
from collections.abc import Callable
from contextlib import contextmanager

from guardrails import config
from guardrails.errors import GuardrailViolation

_CLAIM_TTL = config.RUN_DEADLINE_SECONDS + config.QUEUE_TIMEOUT_SECONDS + 60


class ModelGate:
    def __init__(self, slots: int):
        self._cv = threading.Condition()
        self._slots = slots
        self._running = 0
        self._queue: deque[int] = deque()
        self._next = 0
        self._users: dict[str, float] = {}

    # one generation per creator
    def claim_user(self, user_id) -> bool:
        key, now = str(user_id), time.monotonic()
        with self._cv:
            started = self._users.get(key)
            if started is not None and now - started < _CLAIM_TTL:
                return False
            self._users[key] = now
            return True

    def release_user(self, user_id) -> None:
        with self._cv:
            self._users.pop(str(user_id), None)

    # first come, first served
    def acquire_slot(self, timeout: float, on_wait: Callable[[int], None] | None = None, cancelled: threading.Event | None = None) -> bool:
        with self._cv:
            ticket = self._next
            self._next += 1
            self._queue.append(ticket)
            deadline = time.monotonic() + timeout
            last_position = None
            while True:
                if cancelled is not None and cancelled.is_set():
                    self._queue.remove(ticket)
                    self._cv.notify_all()
                    return False
                if self._running < self._slots and self._queue[0] == ticket:
                    break
                if time.monotonic() > deadline:
                    self._queue.remove(ticket)
                    self._cv.notify_all()
                    return False
                position = self._queue.index(ticket) + 1
                if on_wait and position != last_position:
                    on_wait(position)
                    last_position = position
                self._cv.wait(1.0)
            self._queue.popleft()
            self._running += 1
            self._cv.notify_all()
            return True

    def release_slot(self) -> None:
        with self._cv:
            self._running = max(self._running - 1, 0)
            self._cv.notify_all()

    def busy(self) -> bool:
        with self._cv:
            return self._running >= self._slots or bool(self._queue)


GATE = ModelGate(config.MODEL_CONCURRENCY)


class InFlight:
    """At most `limit` concurrent calls per key."""

    def __init__(self, limit: int, message: str):
        self._limit = limit
        self._message = message
        self._counts: dict[str, int] = {}
        self._lock = threading.Lock()

    @contextmanager
    def hold(self, key):
        key = str(key)
        with self._lock:
            if self._counts.get(key, 0) >= self._limit:
                raise GuardrailViolation(429, self._message, "concurrency")
            self._counts[key] = self._counts.get(key, 0) + 1
        try:
            yield
        finally:
            with self._lock:
                self._counts[key] -= 1
                if not self._counts[key]:
                    del self._counts[key]


ASSISTS = InFlight(config.ASSISTS_IN_FLIGHT_PER_USER, "Another AI edit is still running. Wait for it to finish.")
