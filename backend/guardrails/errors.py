"""Errors that are safe to show, and a way to log the ones that are not."""

import logging
import secrets

from fastapi import HTTPException

log = logging.getLogger("aurea.guardrails")


class GuardrailViolation(HTTPException):
    """A request or a model output was stopped by a guardrail. The detail is safe to show."""

    def __init__(self, status_code: int, detail: str, code: str = "guardrail"):
        super().__init__(status_code, detail)
        self.code = code


def public_error(exc: BaseException, what: str = "The request") -> str:
    """A message for the client. Known, safe errors pass through; anything else is logged
    with a reference the creator can quote, and its details stay on the server."""
    if isinstance(exc, HTTPException) and isinstance(exc.detail, str):
        return exc.detail
    ref = secrets.token_hex(4)
    log.error("%s failed [ref %s]", what, ref, exc_info=exc)
    return f"{what} did not finish. Please try again. (Reference {ref})"
