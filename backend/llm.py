"""The local model, and the only way the app calls it.

Every call goes through _guarded(): kill switch, per-run budget, prompt fitted to the model's
window, the hardened system prompt plus a reminder after the task, output validation, and an
audit record. Agents and routes never call ChatOllama directly.
"""

import re
import time

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from pydantic import BaseModel, ValidationError

from guardrails import audit, config, flags, runctx
from guardrails.errors import GuardrailViolation
from guardrails.prompts import REMINDER, SYSTEM_PROMPT
from guardrails.tokens import estimate_tokens, model_budget
from guardrails.validators import check_output

MODEL_NAME = "qwen3:8b"

_TOO_LONG = "This request is too large for the AI to read at once. Shorten the text and try again."


def get_llm(temperature: float = 0.7, reasoning: bool = False, max_tokens: int = 1000) -> ChatOllama:
    """reasoning=False skips qwen3's <think> pass: much faster, and the agents need reliable
    JSON, not visible chain-of-thought. max_tokens caps output so a looping generation fails
    fast; num_ctx is fixed so prompts are never silently truncated; keep_alive keeps the model
    loaded while the creator reads."""
    return ChatOllama(
        model=MODEL_NAME,
        temperature=temperature,
        reasoning=reasoning,
        num_predict=max_tokens,
        num_ctx=config.LLM_NUM_CTX,
        keep_alive="30m",
        client_kwargs={"timeout": config.LLM_TIMEOUT_SECONDS},
    )


# ---- fitting prompts to the window -------------------------------------------------------

_BLOCK = re.compile(r"(<untrusted_(\w+) id=(\w+)>\n)(.*?)(\n</untrusted_\2 id=\3>)", re.DOTALL)


def fit_prompt(prompt: str, max_tokens: int) -> str:
    """Shrink fenced data blocks (largest first) until the prompt fits the model's window.
    The task and the rules are never cut. Raises if the request still does not fit."""
    budget = model_budget(max_tokens, SYSTEM_PROMPT) - estimate_tokens(REMINDER)
    if budget <= 0:
        raise GuardrailViolation(413, _TOO_LONG, "context")
    for _ in range(8):
        excess = estimate_tokens(prompt) - budget
        if excess <= 0:
            return prompt
        blocks = list(_BLOCK.finditer(prompt))
        if not blocks:
            break
        largest = max(blocks, key=lambda m: len(m.group(4)))
        body = largest.group(4)
        keep = max(len(body) - int(excess * config.CHARS_PER_TOKEN) - 200, 0)
        if keep == len(body):
            break
        trimmed = body[:keep].rsplit(" ", 1)[0] + " [trimmed]" if keep else "[trimmed]"
        prompt = prompt[: largest.start(4)] + trimmed + prompt[largest.end(4) :]
        runctx.warn("Some source material was shortened to fit what the AI can read at once.")
    if estimate_tokens(prompt) > budget:
        raise GuardrailViolation(413, _TOO_LONG, "context")
    return prompt


# ---- guarded calls -------------------------------------------------------------------------


def _messages(prompt: str, max_tokens: int) -> list[BaseMessage]:
    return [SystemMessage(SYSTEM_PROMPT), HumanMessage(fit_prompt(prompt, max_tokens) + REMINDER)]


def _usage(raw) -> tuple[int, int]:
    meta = getattr(raw, "usage_metadata", None) or {}
    return int(meta.get("input_tokens", 0) or 0), int(meta.get("output_tokens", 0) or 0)


def _rebuild(schema: type[BaseModel], original: dict, cleaned: dict) -> BaseModel:
    """The cleaned output as the schema. If cleaning broke a constraint (for example deduped
    hashtags fell under a minimum), those fields keep their original values."""
    try:
        return schema.model_validate(cleaned)
    except ValidationError as exc:
        broken = {e["loc"][0] for e in exc.errors() if e.get("loc")}
        return schema.model_validate({**cleaned, **{k: original[k] for k in broken if k in original}})


def _guarded(call, prompt_text: str, kind: str):
    flags.require("ai")
    started = time.monotonic()
    tokens_in = tokens_out = 0
    try:
        runctx.charge_model_call()
        result, tokens_in, tokens_out = call()
    except GuardrailViolation as exc:
        audit.record(kind=kind, outcome=exc.code, model=MODEL_NAME, prompt=prompt_text, latency_ms=int((time.monotonic() - started) * 1000))
        raise
    except Exception as exc:
        audit.record(kind=kind, outcome="error", model=MODEL_NAME, prompt=prompt_text, latency_ms=int((time.monotonic() - started) * 1000), detail={"error": type(exc).__name__})
        raise
    audit.record(
        kind=kind,
        outcome="ok",
        model=MODEL_NAME,
        prompt=prompt_text,
        prompt_tokens=tokens_in or estimate_tokens(prompt_text),
        output_tokens=tokens_out,
        latency_ms=int((time.monotonic() - started) * 1000),
    )
    return result


def invoke_structured(schema, prompt: str, *, temperature: float = 0.4, max_tokens: int = 1000):
    """One schema-constrained call, retried once if the output was cut off or unparseable.
    The result is validated (policy, leaks, links, personal data) before it is returned."""
    messages = _messages(prompt, max_tokens)
    llm = get_llm(temperature=temperature, max_tokens=max_tokens).with_structured_output(schema, include_raw=True)

    def call():
        out = llm.invoke(messages)
        if out.get("parsing_error") is not None or out.get("parsed") is None:
            runctx.charge_model_call()
            out = llm.invoke(messages)
        if out.get("parsed") is None:
            raise ValueError("the model returned output that does not match the schema")
        tokens_in, tokens_out = _usage(out.get("raw"))
        original = out["parsed"].model_dump()
        cleaned = check_output(original)
        return _rebuild(schema, original, cleaned), tokens_in, tokens_out

    return _guarded(call, prompt, "structured")


def invoke_text(prompt: str, *, temperature: float = 0.4, max_tokens: int = 1000) -> str:
    messages = _messages(prompt, max_tokens)
    llm = get_llm(temperature=temperature, max_tokens=max_tokens)

    def call():
        raw = llm.invoke(messages)
        return check_output(str(raw.content)), *_usage(raw)

    return _guarded(call, prompt, "text")


def invoke_html(prompt: str, *, temperature: float = 0.4, max_tokens: int = 2200) -> str:
    """A design page as HTML. Policy and leak checks run on the reply; the design sanitizer, not the
    text scrubber, cleans the markup (design/sanitize.py)."""
    from design.sanitize import visible_text

    messages = _messages(prompt, max_tokens)
    llm = get_llm(temperature=temperature, max_tokens=max_tokens)

    def call():
        raw = str(llm.invoke(messages).content)
        check_output(visible_text(raw), scrub=False)
        return raw, 0, 0

    return _guarded(call, prompt, "html")


def invoke_chat(history: list[dict], *, temperature: float = 0.6, max_tokens: int = 1000) -> str:
    """A conversation turn. `history` ends with the new user message and has already been fitted
    to the model's window by guardrails.conversation."""
    messages: list[BaseMessage] = [SystemMessage(SYSTEM_PROMPT)]
    for i, m in enumerate(history):
        last = i == len(history) - 1
        if m["role"] == "user":
            messages.append(HumanMessage(m["content"] + (REMINDER if last else "")))
        else:
            messages.append(AIMessage(m["content"]))
    llm = get_llm(temperature=temperature, max_tokens=max_tokens)
    prompt_text = "\n".join(m["content"] for m in history)

    def call():
        raw = llm.invoke(messages)
        return check_output(str(raw.content), classifier=True), *_usage(raw)

    return _guarded(call, prompt_text, "chat")


if __name__ == "__main__":
    print(f"Model: {MODEL_NAME}")
    print(f"Response: {invoke_text('Reply with exactly one word: hello', max_tokens=20)}")
