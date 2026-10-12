"""HTTP-level guardrails: request size, security headers, and cross-site request checks."""

import json

from fastapi import HTTPException

from guardrails import config

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


async def _reject(send, status: int, detail: str) -> None:
    body = json.dumps({"detail": detail}).encode()
    await send({"type": "http.response.start", "status": status, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})


class BodySizeLimit:
    """Refuse bodies over MAX_BODY_BYTES before they are read into memory."""

    def __init__(self, app, max_bytes: int | None = None):
        self.app = app
        self.max_bytes = max_bytes or config.MAX_BODY_BYTES

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers") or [])
        declared = headers.get(b"content-length")
        if declared is not None:
            try:
                if int(declared) > self.max_bytes:
                    return await _reject(send, 413, "This request is too large.")
            except ValueError:
                return await _reject(send, 400, "Invalid Content-Length.")
        seen = 0

        async def limited_receive():
            nonlocal seen
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > self.max_bytes:
                    raise _TooLarge()
            return message

        try:
            await self.app(scope, limited_receive, send)
        except _TooLarge:
            await _reject(send, 413, "This request is too large.")


class _TooLarge(HTTPException):
    # An HTTPException so FastAPI answers 413 itself instead of reporting a parse error.
    def __init__(self):
        super().__init__(413, "This request is too large.")


class SecurityHeaders:
    def __init__(self, app, hsts: bool = False):
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        docs = scope["path"].startswith(("/docs", "/redoc", "/openapi.json"))

        async def with_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers") or [])
                present = {k.lower() for k, _ in headers}
                extra = [
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"no-referrer"),
                    (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
                    (b"cross-origin-opener-policy", b"same-origin"),
                ]
                if not docs:
                    extra.append((b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"))
                if self.hsts:
                    extra.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
                headers += [(k, v) for k, v in extra if k not in present]
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, with_headers)


class OriginGuard:
    """Cross-site request forgery defense. Browsers mark every request with where it came from;
    state-changing requests from another site are refused even if cookies would be sent."""

    def __init__(self, app, allowed_origins: list[str]):
        self.app = app
        self.allowed = {o.rstrip("/").lower() for o in allowed_origins}

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] in _SAFE_METHODS:
            return await self.app(scope, receive, send)
        headers = {k.decode().lower(): v.decode(errors="replace") for k, v in scope.get("headers") or []}
        origin = headers.get("origin", "").rstrip("/").lower()
        fetch_site = headers.get("sec-fetch-site", "")
        if origin and origin != "null" and origin not in self.allowed:
            return await _reject(send, 403, "This request came from a site that is not allowed.")
        if fetch_site == "cross-site" and origin not in self.allowed:
            return await _reject(send, 403, "This request came from a site that is not allowed.")
        if origin == "null":
            return await _reject(send, 403, "This request came from a site that is not allowed.")
        return await self.app(scope, receive, send)
