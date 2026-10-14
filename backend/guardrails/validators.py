"""Input and output validators.

Inputs come in two kinds:
  instructions  what the creator asks for (a topic, notes, a chat message). Refused when they
                break the content policy or try to override the AI's rules.
  data          material the AI reads (pasted text, slide copy, example posts). Refused only for
                the worst policy categories; instruction-like sentences are removed instead, because
                an article about prompt injection is fine to summarize.
Outputs pass through check_output: house normalization, links and personal data removed,
hashtags sanitized, and a hard stop if the content breaks policy or leaks the system rules.
"""

import re

from guardrails import runctx
from guardrails.errors import GuardrailViolation
from guardrails.injection import scan
from guardrails.moderation import moderate
from guardrails.prompts import CANARY
from guardrails.sanitize import normalize
from guardrails.untrusted import clean_data

ALWAYS_BLOCKED = {"sexual_minors", "weapons", "malware", "violent_extremism"}

INJECTION_MESSAGE = (
    "This request looks like an attempt to change how Aurea's AI works, so it was not run. "
    "Describe the content you want instead."
)


def _policy_message(categories: str) -> str:
    return f"Aurea cannot help with this because it involves {categories}. Try a different topic."


def check_instruction(text: str, field: str = "request", *, max_chars: int | None = None, classifier: bool = True) -> str:
    """Validate something the creator asks the AI to do. Returns the normalized text."""
    text = normalize(text or "").strip()
    if max_chars is not None and len(text) > max_chars:
        raise GuardrailViolation(422, f"The {field} is too long. Keep it under {max_chars} characters.", "too_long")
    if not text:
        return text
    verdict = moderate(text, use_classifier=classifier)
    if verdict.blocked:
        raise GuardrailViolation(422, _policy_message(verdict.describe()), "policy")
    if scan(text).blocked:
        raise GuardrailViolation(422, INJECTION_MESSAGE, "injection")
    return text


def check_data(text: str, what: str = "the text", *, max_chars: int | None = None) -> str:
    """Validate material the AI will read. Returns cleaned text."""
    text = normalize(text or "")
    if max_chars is not None and len(text) > max_chars:
        raise GuardrailViolation(422, f"{what.capitalize()} is too long. Keep it under {max_chars} characters.", "too_long")
    verdict = moderate(text)
    hard = [c for c in verdict.categories if c in ALWAYS_BLOCKED]
    if hard:
        raise GuardrailViolation(422, _policy_message(", ".join(hard).replace("_", " ")), "policy")
    warnings: list[str] = []
    cleaned = clean_data(text, warnings, what)
    for w in warnings:
        runctx.warn(w)
    return cleaned


def check_profile_text(text: str, field: str) -> str:
    """Stored creator settings that later go into prompts (niche, tone, example posts, series
    prompts, trend topics). Checked once on save so they cannot carry a stored injection."""
    text = normalize(text or "")
    if not text.strip():
        return text
    verdict = moderate(text)
    if verdict.blocked:
        raise GuardrailViolation(422, f"Your {field} cannot be saved because it involves {verdict.describe()}.", "policy")
    if scan(text).blocked:
        raise GuardrailViolation(422, f"Your {field} contains instructions aimed at the AI. Describe your content instead.", "injection")
    return text


# ---- outputs -------------------------------------------------------------------------------

_URL = re.compile(r"\b(?:https?://|www\.)[^\s<>()\"']+", re.IGNORECASE)
_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b")
_PHONE = re.compile(r"(?<![\w$€£.,])(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b")
_SSN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
_CARD = re.compile(r"\b(?:\d[ -]?){13,19}\b")
_LEAK = re.compile(
    r"\b(my|the) (system prompt|system message|hidden instructions|security rules) (is|are|says?)\b|"
    r"\bas (an? )?(DAN|unfiltered|jailbroken|unrestricted) (ai|model|assistant)\b|"
    r"\bdeveloper mode (enabled|output|activated)\b|"
    r"\bi (have|now have) no (restrictions|rules|filters|limits)\b",
    re.IGNORECASE,
)
_HASHTAG_KEYS = {"hashtags"}
_SKIP_KEYS = {"url", "icon", "type", "variant", "role", "platform", "format", "kind", "template", "visual"}


def _luhn(digits: str) -> bool:
    total, alt = 0, False
    for d in reversed(digits):
        n = int(d)
        if alt:
            n = n * 2 - 9 if n > 4 else n * 2
        total += n
        alt = not alt
    return total % 10 == 0


def _scrub(text: str, notes: set[str]) -> str:
    text = normalize(text)
    if _URL.search(text):
        text = _URL.sub("", text)
        notes.add("Links in AI text were removed. Add your own links when you post.")
    if _EMAIL.search(text) or _PHONE.search(text) or _SSN.search(text):
        text = _SSN.sub("", _PHONE.sub("", _EMAIL.sub("", text)))
        notes.add("Personal contact details in AI text were removed.")
    for match in list(_CARD.finditer(text)):
        digits = re.sub(r"\D", "", match.group(0))
        if 13 <= len(digits) <= 19 and _luhn(digits):
            text = text.replace(match.group(0), "")
            notes.add("A card-like number in AI text was removed.")
    return re.sub(r"[ \t]{2,}", " ", text).strip()


def _hashtag(tag: str) -> str:
    return re.sub(r"[^\w]", "", normalize(tag))[:30]


def _walk(value, notes: set[str], key: str = ""):
    if isinstance(value, str):
        return value if key in _SKIP_KEYS else _scrub(value, notes)
    if isinstance(value, list):
        if key in _HASHTAG_KEYS:
            seen, tags = set(), []
            for t in value:
                h = _hashtag(t) if isinstance(t, str) else ""
                if h and h.lower() not in seen:
                    seen.add(h.lower())
                    tags.append(h)
            return tags
        return [_walk(v, notes, key) for v in value]
    if isinstance(value, dict):
        return {k: _walk(v, notes, k) for k, v in value.items()}
    return value


def _all_text(value) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(_all_text(v) for v in value)
    if isinstance(value, dict):
        return "\n".join(_all_text(v) for v in value.values())
    return ""


def check_output(value, *, classifier: bool = False, scrub: bool = True):
    """Validate and clean a model output (a string or a JSON-like value). Raises when the output
    must not be shown at all; otherwise returns the cleaned value and records warnings.
    scrub=False skips link and contact removal, for HTML that the design sanitizer cleans instead
    (a flyer's contact block is meant to carry an email address)."""
    text = normalize(_all_text(value))
    if CANARY in text or _LEAK.search(text):
        raise GuardrailViolation(502, "The AI's answer was withheld because it did not follow Aurea's rules. Please try again.", "leak")
    verdict = moderate(text, use_classifier=classifier, role="assistant")
    if verdict.blocked:
        raise GuardrailViolation(422, f"The AI's answer was withheld because it involved {verdict.describe()}.", "output_policy")
    if not scrub:
        return value
    notes: set[str] = set()
    cleaned = _walk(value, notes)
    for note in sorted(notes):
        runctx.warn(note)
    return cleaned


def check_publishable(text: str) -> None:
    """Last check before anything leaves Aurea for a social network."""
    verdict = moderate(text or "", use_classifier=True, role="assistant")
    if verdict.blocked:
        raise GuardrailViolation(422, f"This post was not published because it involves {verdict.describe()}. Edit the caption and try again.", "publish_policy")
