"""Prompt injection and jailbreak detection.

A weighted rule set: each pattern adds to a score. At BLOCK or more, text that is meant
as an instruction (a topic, notes, a chat message) is refused, and text that is only data
(web results, pasted articles, slide copy) has the offending lines removed. The rules are
deliberately specific so ordinary creator topics ("how to ignore negative comments") pass.
backend/guardrails/evals/redteam.jsonl holds the cases they are tested against.
"""

import re
from dataclasses import dataclass, field

from guardrails.sanitize import normalize

BLOCK = 3.0
SUSPICIOUS = 1.5

_I = re.IGNORECASE
_RULES: list[tuple[str, re.Pattern, float]] = [
    (
        "override_instructions",
        re.compile(
            r"\b(ignore|disregard|forget|override|bypass|skip|drop)\b[^.\n]{0,40}?"
            r"\b(previous|prior|above|earlier|preceding|all|any|your|these|those|system|original)\b[^.\n]{0,30}?"
            r"\b(instructions?|prompts?|rules|directions|directives|guidelines|guardrails|context|constraints)\b",
            _I,
        ),
        3.0,
    ),
    (
        "prompt_extraction",
        re.compile(
            r"\b(reveal|show|print|repeat|output|display|leak|tell me|what (is|are|were)|give me)\b[^.\n]{0,40}?"
            r"\b(system|hidden|initial|original|developer|secret|internal)\s+(prompt|instructions?|message|rules|guidelines)",
            _I,
        ),
        3.0,
    ),
    ("verbatim_extraction", re.compile(r"\b(repeat|print|output)\b[^.\n]{0,30}\b(everything|all text|the text) (above|before)\b", _I), 3.0),
    ("persona_switch", re.compile(r"\byou are (now|no longer|free)\b|\bfrom now on,? you (are|will|must)\b", _I), 2.0),
    ("new_instructions", re.compile(r"\b(new|updated|real|actual|secret|hidden) (instructions?|rules|task|objective|system prompt)\s*[:\-]", _I), 2.0),
    (
        "unrestricted_mode",
        re.compile(
            r"\b(act|behave|respond|answer|pretend|roleplay|role-play|simulate|become)\b[^.\n]{0,40}?"
            r"\b(unrestricted|unfiltered|uncensored|jailbroken|amoral|evil|(without|with no|with zero|free of) (any )?(rules|limits|restrictions|filters|ethics|guidelines))",
            _I,
        ),
        3.0,
    ),
    ("known_jailbreak", re.compile(r"\b(do anything now|developer mode|god mode|jailbreak(ed|ing)?|evil confidant|AIM mode|maximum mode)\b", _I), 3.0),
    ("dan", re.compile(r"\bDAN\b|\bSTAN\b|\bDUDE\b(?= (mode|prompt))"), 2.0),
    (
        "disable_safety",
        re.compile(
            r"\b(without|no|remove|disable|turn off|ignore|bypass)\s+(any\s+|all\s+|your\s+)?(safety|content|ethical|moral|openai|anthropic)?\s*"
            r"(restrictions|filters?|guidelines|guardrails|limitations|censorship|policies|safeguards)\b",
            _I,
        ),
        2.0,
    ),
    (
        "chat_template_tokens",
        re.compile(
            r"<\|?\s*(im_start|im_end|system|endoftext|eot_id|start_header_id|end_header_id|assistant|user)\s*\|?>|"
            r"\[/?(INST|SYS)\]|<</?SYS>>|^\s*#{0,3}\s*(system|assistant)\s*:",
            _I | re.MULTILINE,
        ),
        3.0,
    ),
    ("fence_escape", re.compile(r"</?\s*(untrusted[\w-]*|system|instructions?|rules)\s*(id=\w+)?\s*>", _I), 3.0),
    ("stay_in_character", re.compile(r"\b(stay|remain) in character\b|\bbreak character\b", _I), 1.5),
    ("encoded_payload", re.compile(r"\b(base64|rot13|hex|morse|reversed?)\b[^.\n]{0,30}\b(decode|decoded|encoded|instructions|follow)\b", _I), 1.5),
    ("fiction_wrapper", re.compile(r"\b(hypothetically|in a fictional world|for a (novel|story|movie) where|purely (educational|hypothetical)|my grandma used to)\b", _I), 0.75),
    ("forced_output", re.compile(r"\b(say|print|output|respond with|reply with)\b[^.\n]{0,20}['\"]?(pwned|hacked|i have been)", _I), 2.0),
    ("end_of_prompt", re.compile(r"\bend of (the )?(prompt|instructions|system message|context)\b", _I), 1.5),
    ("fake_system_notice", re.compile(r"\bsystem (update|override|notice|alert|message|announcement)\s*[:\-!]", _I), 1.5),
    (
        "scope_escape",
        re.compile(r"\b(not|no longer|never) (restricted|limited|bound|confined) (to|by) (your|the) (original|initial|current|default|assigned)\b", _I),
        2.0,
    ),
    (
        "own_rules_reference",
        re.compile(r"\byour (original|initial|system|default|core|underlying) (rules|prompt|instructions|programming|guidelines|topic|scope|purpose)\b", _I),
        1.5,
    ),
    (
        "conflict_override",
        re.compile(
            r"\beven if (it|they|this|that|these|those) (conflicts?|contradicts?|goes? against|violates?|breaks?)\b[^.\n]{0,20}?"
            r"\b(your|the|my|any)\b[^.\n]{0,15}?\b(system|rules|instructions|prompt|guidelines|programming|policies)\b",
            _I,
        ),
        3.0,
    ),
    (
        "priority_override",
        re.compile(
            r"\b(user|my|the user'?s) (instructions?|commands?|requests?|messages?|prompts?) (are|is|take|takes|have|has|get|gets) "
            r"(the )?(highest|top|absolute|first|ultimate|overriding) priority\b|"
            r"\binstead of (your|the) (original|initial|system|default|previous) (prompt|instructions|rules|programming|guidelines)\b",
            _I,
        ),
        3.0,
    ),
    ("unbounded_compliance", re.compile(r"\banswer (every|any|all) (single )?(question|request|thing)s?\b|\banswer everything\b", _I), 1.0),
    ("authority_claim",re.compile(r"\b(i am|this is) (your|the) (developer|creator|administrator|admin|system|openai|anthropic)\b", _I), 1.5),
]


@dataclass
class InjectionVerdict:
    score: float = 0.0
    labels: list[str] = field(default_factory=list)

    @property
    def blocked(self) -> bool:
        return self.score >= BLOCK

    @property
    def suspicious(self) -> bool:
        return self.score >= SUSPICIOUS


def scan(text: str) -> InjectionVerdict:
    text = normalize(text)
    verdict = InjectionVerdict()
    for label, pattern, weight in _RULES:
        if pattern.search(text):
            verdict.score += weight
            verdict.labels.append(label)
    return verdict


_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")


def neutralize(text: str) -> tuple[str, int]:
    """Remove the sentences of a data block that carry an injection. Returns (text, removed)."""
    text = normalize(text)
    if not scan(text).suspicious:
        return text, 0
    removed = 0
    lines = []
    for line in text.split("\n"):
        kept = []
        for sentence in _SPLIT.split(line):
            if scan(sentence).blocked:
                removed += 1
                continue
            kept.append(sentence)
        lines.append(" ".join(kept))
    out = "\n".join(lines)
    if scan(out).blocked:  # the payload spans sentences: drop the whole block
        return "", removed + 1
    return out, removed
