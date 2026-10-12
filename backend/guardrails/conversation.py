"""Chat conversations with a bounded context window.

Each conversation keeps at most CONTEXT_WINDOW_TOKENS (200,000 by default) of history. When a
new turn would push it past that, the oldest messages are removed from the conversation, a
question and its answer together, until it fits. Of what is kept, the newest part that fits
the model's own window (LLM_NUM_CTX) is sent with each turn.
"""

import uuid

from db import connection
from guardrails import config
from guardrails.errors import GuardrailViolation
from guardrails.prompts import REMINDER, SYSTEM_PROMPT
from guardrails.semantic import screen
from guardrails.tokens import estimate_tokens, fit_history, message_tokens, model_budget
from guardrails.validators import check_instruction

MAX_MESSAGE_CHARS = 8000
REPLY_TOKENS = 1000


def _owned(conn, conversation_id: str, user_id) -> None:
    row = conn.execute("SELECT 1 FROM chat_conversations WHERE id = %s AND user_id = %s", (conversation_id, user_id)).fetchone()
    if not row:
        raise GuardrailViolation(404, "Conversation not found.", "not_found")


def _history(conn, conversation_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT id, role, content FROM chat_messages WHERE conversation_id = %s ORDER BY id", (conversation_id,)
    ).fetchall()
    return [{"id": r["id"], "role": r["role"], "content": r["content"]} for r in rows]


def chat_turn(user_id, conversation_id: str | None, message: str) -> dict:
    from llm import MODEL_NAME, invoke_chat  # llm imports guardrails; import late

    message = check_instruction(message, "message", max_chars=MAX_MESSAGE_CHARS)
    if not message:
        raise GuardrailViolation(422, "Write a message first.", "empty")
    new = {"role": "user", "content": message}

    with connection() as conn:
        if conversation_id:
            _owned(conn, conversation_id, user_id)
            history = _history(conn, conversation_id)
        else:
            conversation_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO chat_conversations (id, user_id, title) VALUES (%s, %s, %s)", (conversation_id, user_id, message[:80])
            )
            history = []

    previous = next((m["content"] for m in reversed(history) if m["role"] == "user"), "")
    screen(f"{previous[-1500:]}\n{message}".strip(), "message")

    # 1. The conversation itself: keep the newest CONTEXT_WINDOW_TOKENS, remove the oldest.
    retained = fit_history(history + [new], config.CONTEXT_WINDOW_TOKENS)
    removed_ids = [m["id"] for m in retained.dropped if "id" in m]

    # 2. What the model reads this turn: the newest part of that which fits its window.
    budget = model_budget(REPLY_TOKENS, SYSTEM_PROMPT) - estimate_tokens(REMINDER)
    sent = fit_history(retained.kept, budget)
    if not sent.kept or sent.kept[-1] is not new:
        raise GuardrailViolation(413, "This message is too long for the AI to read. Shorten it and try again.", "context")

    reply = invoke_chat(sent.kept, max_tokens=REPLY_TOKENS)

    with connection() as conn:
        if removed_ids:
            conn.execute("DELETE FROM chat_messages WHERE id = ANY(%s) AND conversation_id = %s", (removed_ids, conversation_id))
        for m in (new, {"role": "assistant", "content": reply}):
            conn.execute(
                "INSERT INTO chat_messages (conversation_id, user_id, role, content, tokens) VALUES (%s, %s, %s, %s, %s)",
                (conversation_id, user_id, m["role"], m["content"], message_tokens(m)),
            )
        conn.execute("UPDATE chat_conversations SET updated_at = now() WHERE id = %s", (conversation_id,))
        total = conn.execute(
            "SELECT COALESCE(SUM(tokens), 0) AS n FROM chat_messages WHERE conversation_id = %s", (conversation_id,)
        ).fetchone()["n"]

    return {
        "conversation_id": conversation_id,
        "model": MODEL_NAME,
        "response": reply,
        "context": {
            "window_tokens": config.CONTEXT_WINDOW_TOKENS,
            "conversation_tokens": int(total),
            "removed_messages": len(removed_ids),
            "messages_sent_to_model": len(sent.kept),
        },
    }


def get_conversation(user_id, conversation_id: str) -> dict:
    with connection() as conn:
        _owned(conn, conversation_id, user_id)
        history = _history(conn, conversation_id)
    return {"conversation_id": conversation_id, "messages": [{"role": m["role"], "content": m["content"]} for m in history]}


def delete_conversation(user_id, conversation_id: str) -> None:
    with connection() as conn:
        conn.execute("DELETE FROM chat_conversations WHERE id = %s AND user_id = %s", (conversation_id, user_id))
