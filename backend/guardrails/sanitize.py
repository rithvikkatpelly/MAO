"""Text normalization applied to everything that goes into or comes out of the model.

Removes characters that hide instructions from people but not from models: zero-width and
bidirectional controls, Unicode tag characters (used for "ASCII smuggling"), and control codes.
"""

import re
import unicodedata

_INVISIBLE = re.compile(
    "["
    "­"  # soft hyphen
    "᠎"
    "​-‏"  # zero-width space, joiners, direction marks
    "‪-‮"  # bidi embeddings and overrides
    "⁠-⁤"
    "⁦-⁩"  # bidi isolates
    "﻿"
    "\U000e0000-\U000e007f"  # tag characters
    "]"
)
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")


def normalize(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = _INVISIBLE.sub("", text)
    text = _CONTROL.sub("", text)
    return text.replace("\r\n", "\n").replace("\r", "\n")


def normalize_deep(value):
    """normalize() every string in a JSON-like value."""
    if isinstance(value, str):
        return normalize(value)
    if isinstance(value, list):
        return [normalize_deep(v) for v in value]
    if isinstance(value, dict):
        return {k: normalize_deep(v) for k, v in value.items()}
    return value
