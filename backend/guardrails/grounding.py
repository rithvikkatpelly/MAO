"""Grounding checks: citations must point at real sources, numbers must come from the
evidence, and generated copy must not reproduce source text or the creator's examples."""

import re

from guardrails import runctx

_NUMBER = re.compile(r"(\$|€|£)?\d[\d,.]*\s?(%|percent|x\b|k\b|m\b|bn?\b|million|billion|times)?", re.I)
_CITE = re.compile(r"\[(\d+)\]")


def numbers_in(text: str) -> list[str]:
    return [m.group(0).strip() for m in _NUMBER.finditer(text or "") if any(c.isdigit() for c in m.group(0))]


def _digits(s: str) -> str:
    return re.sub(r"[^\d.]", "", s).strip(".")


def verify_citations(facts: str, source_count: int, sources_text: str = "") -> str:
    """Keep only bullet lines whose citations all point at a source that exists and, when the
    sources are given, whose numbers appear in them. The extracting model is not evidence."""
    kept, dropped = [], 0
    for line in (facts or "").splitlines():
        if not line.strip():
            continue
        cites = [int(n) for n in _CITE.findall(line)]
        claim = _CITE.sub("", line)
        if not cites or not all(1 <= n <= source_count for n in cites):
            dropped += 1
        elif sources_text and unsupported_numbers([claim], sources_text):
            dropped += 1
        else:
            kept.append(line)
    if dropped:
        runctx.warn(f"Dropped {dropped} research fact{'s' if dropped > 1 else ''} that did not match its sources.")
    return "\n".join(kept)


def unsupported_numbers(texts: list[str], evidence: str) -> list[str]:
    """Numbers in the generated text that do not appear in the evidence. Small counts
    (like "3 tips") are ignored; they describe the post, not a fact."""
    known = {_digits(n) for n in numbers_in(evidence)} - {""}
    missing = []
    for text in texts:
        for n in numbers_in(text):
            d = _digits(n)
            if not d or d in known:
                continue
            try:
                if float(d) <= 10 and not re.search(r"[%$€£]|million|billion", n, re.I):
                    continue
            except ValueError:
                pass
            if n not in missing:
                missing.append(n)
    return missing


def _shingles(text: str, n: int) -> set[tuple[str, ...]]:
    words = re.findall(r"[a-z0-9']+", (text or "").lower())
    return {tuple(words[i : i + n]) for i in range(len(words) - n + 1)}


def copied_from(text: str, references: list[str], n: int = 8) -> bool:
    """True when any run of n words in text appears verbatim in a reference."""
    mine = _shingles(text, n)
    if not mine:
        return False
    return any(mine & _shingles(ref, n) for ref in references if ref)


def review_copy(texts: list[str], *, evidence: str, sources: list[str], examples: list[str]) -> None:
    """Record warnings for the editor. Nothing is blocked: the creator decides."""
    missing = unsupported_numbers(texts, evidence)
    if missing:
        runctx.warn("Check these numbers against your sources, the research did not contain them: " + ", ".join(missing[:6]) + ".")
    joined = "\n".join(texts)
    if copied_from(joined, sources):
        runctx.warn("Some wording matches a source word for word. Rephrase it or quote and credit the source.")
    if copied_from(joined, examples):
        runctx.warn("Some wording repeats one of your example posts word for word.")
