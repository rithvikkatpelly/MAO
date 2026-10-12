"""Test setup. Database tests run only against TEST_DATABASE_URL, never the DATABASE_URL in
backend/.env, so a test run can never touch real data. Without it they are skipped."""

import os
import secrets
import sys
from pathlib import Path

TEST_DB = os.environ.get("TEST_DATABASE_URL", "")
os.environ["DATABASE_URL"] = TEST_DB  # set before settings.py loads .env (which never overrides)
os.environ["COOKIE_SECURE"] = "false"
os.environ["COOKIE_SAMESITE"] = "lax"
os.environ["ALLOWED_ORIGINS"] = "http://localhost:5173"
os.environ["GUARD_MODEL"] = ""
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from langchain_core.messages import AIMessage  # noqa: E402

needs_db = pytest.mark.skipif(not TEST_DB, reason="set TEST_DATABASE_URL to run database tests")


class FakeStructured:
    def __init__(self, parent, schema):
        self.parent, self.schema = parent, schema

    def invoke(self, messages):
        self.parent.calls.append(messages)
        data = self.parent.structured.get(self.schema.__name__)
        if data is None:
            raise AssertionError(f"no fake output for {self.schema.__name__}")
        return {"raw": AIMessage(content="", usage_metadata={"input_tokens": 50, "output_tokens": 20, "total_tokens": 70}), "parsed": self.schema.model_validate(data), "parsing_error": None}


class FakeLLM:
    """Stands in for ChatOllama: records the messages it was sent and returns canned output."""

    def __init__(self):
        self.calls: list = []
        self.reply = "Here is a short reply."
        self.structured: dict = {
            "SlideCopy": {"headline": "A sharper headline", "body": "One clear line."},
            "HookOptions": {"hooks": ["Hook one", "Hook two", "Hook three"]},
        }

    def __call__(self, *args, **kwargs):
        return self

    def with_structured_output(self, schema, include_raw=False):
        return FakeStructured(self, schema)

    def invoke(self, messages):
        self.calls.append(messages)
        return AIMessage(content=self.reply)


@pytest.fixture
def fake_llm(monkeypatch):
    import llm

    fake = FakeLLM()
    monkeypatch.setattr(llm, "get_llm", fake)
    return fake


@pytest.fixture(scope="session")
def client():
    if not TEST_DB:
        pytest.skip("set TEST_DATABASE_URL to run database tests")
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app, base_url="http://localhost:8000") as c:
        yield c


@pytest.fixture
def login(client):
    """Signs in a fresh user and returns (user_id, cookies)."""
    from api.auth import _hash, _upsert_user
    from db import connection

    def make():
        sub = "test-" + secrets.token_hex(6)
        user = _upsert_user(sub, f"{sub}@example.com", "Test Creator", "")
        token = secrets.token_urlsafe(32)
        with connection() as conn:
            conn.execute(
                "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, now() + interval '1 day')",
                (_hash(token), user["id"]),
            )
        return str(user["id"]), {"aurea_session": token}

    return make


@pytest.fixture(autouse=True)
def _reset_limits():
    from guardrails import ratelimit

    ratelimit._hits.clear()
    yield


@pytest.fixture(autouse=True)
def fake_semantic(monkeypatch):
    """Stands in for the semantic classifier: anything containing "poison someone" is harmful.
    Tests never call the real model. guardrails.evals --live checks the real classifier."""
    from guardrails import semantic

    semantic._cache.clear()
    calls: list[str] = []

    def classify(text):
        calls.append(text)
        if "poison someone" in " ".join(text.lower().split()):
            return semantic.IntentVerdict(reason="asks how to poison a person", category="violence", harmful=True)
        return semantic.IntentVerdict(reason="ordinary creator topic", category="safe", harmful=False)

    monkeypatch.setattr(semantic, "classify", classify)
    return calls
