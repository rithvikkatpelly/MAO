"""Token estimates and the context window.

Two limits apply:
  CONTEXT_WINDOW_TOKENS (200,000 by default) is how much conversation history is kept. When a
  conversation grows past it, the oldest messages are removed until it fits again.
  LLM_NUM_CTX is how much the local model reads per call. What is sent is fitted to it, so the
  model never truncates the prompt on its own (Ollama cuts from the start, where the rules are).
There is no tokenizer for the local model here, so counts are conservative estimates.
"""

import math
from dataclasses import dataclass

from guardrails import config

MESSAGE_OVERHEAD = 6  # role markers and separators per message


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return math.ceil(len(text) / config.CHARS_PER_TOKEN)


def message_tokens(message: dict) -> int:
    return estimate_tokens(message.get("content", "")) + MESSAGE_OVERHEAD


@dataclass
class Fitted:
    kept: list[dict]
    dropped: list[dict]
    tokens: int


def fit_history(history: list[dict], budget: int) -> Fitted:
    """Keep the newest messages whose total fits the budget; drop the oldest first.
    A user message and the reply that follows it are dropped together, so the kept history
    never starts with an orphaned reply."""
    kept: list[dict] = []
    total = 0
    for message in reversed(history):
        cost = message_tokens(message)
        if total + cost > budget:
            break
        kept.append(message)
        total += cost
    kept.reverse()
    while kept and kept[0].get("role") == "assistant":
        total -= message_tokens(kept.pop(0))
    dropped = history[: len(history) - len(kept)]
    return Fitted(kept=kept, dropped=dropped, tokens=total)


def model_budget(max_output_tokens: int, system_text: str = "") -> int:
    """Tokens left for the prompt once the system message and the reply are reserved."""
    return config.LLM_NUM_CTX - max_output_tokens - estimate_tokens(system_text) - 64
