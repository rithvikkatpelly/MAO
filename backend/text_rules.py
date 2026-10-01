"""House style for generated copy: no em/en dashes and no emojis.

Prompts ask for this too, but small local models slip, so AI output passes
through clean() before it is returned. Mirrors frontend/src/lib/text.js.
"""

import re

_RANGE_DASH = re.compile(r"(?<=\d)\s*[–—]\s*(?=\d)")
_DASH = re.compile(r"\s*[–—―]+\s*")
_EMOJI = re.compile(
    "["
    "\U0001F000-\U0001FAFF"
    "\U0001F1E6-\U0001F1FF"
    "☀-➿"
    "⬀-⯿"
    "⌀-⏿"
    "️‍⃣"
    "]"
)

STYLE_RULE = "Never use em dashes, en dashes, or emojis. Plain text only."


def clean_text(text: str) -> str:
    text = _RANGE_DASH.sub("-", text or "")
    text = _DASH.sub(", ", text)
    text = _EMOJI.sub("", text)
    text = text.replace(",,", ",")
    text = re.sub(r"[ \t]+([,.!?;:])", r"\1", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip(" ,")


def clean(value):
    """Recursively clean every string in a JSON-like value."""
    if isinstance(value, str):
        return clean_text(value)
    if isinstance(value, list):
        return [clean(v) for v in value]
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    return value
