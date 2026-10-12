"""Content policy: what Aurea refuses to research, write, or publish.

Rules catch clear harmful intent cheaply. When GUARD_MODEL is set (for example
llama-guard3:1b in Ollama), a safety classifier also reviews instructions, chat, and
anything about to be published. If that model is unavailable the rules still apply.
"""

import logging
import re
import time
from dataclasses import dataclass, field

from guardrails import config
from guardrails.sanitize import normalize

log = logging.getLogger("aurea.guardrails")

_I = re.IGNORECASE
_HOWTO = r"\b(how (do i|to|can i|would i)|steps? (to|for)|instructions? (for|to|on)|guide (to|for)|recipe for|tutorial (on|for)|teach me to|ways to)\b"

POLICY: dict[str, list[re.Pattern]] = {
    "sexual_minors": [
        re.compile(r"\b(child porn\w*|csam|kiddie porn|pedo porn)\b", _I),
        re.compile(r"\b(nude|naked|erotic|lewd|sexy|explicit|sexual)\s+(photos?|pics?|images?|pictures?|videos?|stories|story|content|roleplay)\s+(of|about|with|featuring)\s+(a\s+|an\s+|my\s+)?(child|children|minors?|kids?|preteens?|underage|little (girl|boy)s?|\d{1,2}[- ]?(yo|y/o|year[- ]old))\b", _I),
        re.compile(r"\b(write|generate|create|describe)\b[^.\n]{0,30}\b(erotic|sexual|lewd|explicit)\b[^.\n]{0,30}\b(child|children|minors?|underage|preteens?|\d{1,2}[- ]year[- ]old)\b", _I),
    ],
    "weapons": [
        re.compile(
            _HOWTO + r"[^.\n]{0,40}\b(make|build|assemble|synthesi[sz]e|manufacture|3d[- ]print)\b[^.\n]{0,30}"
            r"(?<!bath )(?<!seed )(?<!flavor )(?<!flavour )(?<!photo )(?<!glitter )(?<!cherry )\b(bombs?|explosives?|ieds?|pipe bombs?|napalm|thermite charges?|nerve agents?|sarin|ricin|anthrax spores|bioweapons?|chemical weapons?|ghost guns?|gun silencers?)\b",
            _I,
        ),
        re.compile(r"\b(make|build|synthesi[sz]e|assemble)\s+(a\s+|an\s+|some\s+)?(pipe bomb|molotov cocktail|nerve agent|sarin|ricin|ied)\b", _I),
    ],
    "drugs": [
        re.compile(r"\b(synthesi[sz]e|cook|make|manufacture|extract)\s+(some\s+|my own\s+)?(meth|methamphetamine|fentanyl|heroin|crack cocaine|lsd|mdma)\b", _I),
    ],
    "self_harm": [
        re.compile(_HOWTO + r"[^.\n]{0,30}\b(kill (myself|yourself|themselves)|commit suicide|end (my|your) life|self[- ]harm|cut (myself|yourself))\b(?![^.\n]{0,20}\b(prevention|help|support|awareness|signs)\b)", _I),
        re.compile(r"\b(you should|go) (kill yourself|die)\b|\bkys\b", _I),
    ],
    "violent_extremism": [
        re.compile(r"\b(join|recruit(ing)? for|praise|glorify)\s+(the\s+)?(isis|isil|al[- ]qaeda|neo-?nazis?|kkk|ku klux klan|atomwaffen)\b", _I),
        re.compile(r"\b(how (do i|to|can i)\s+)?(plan|carry out|commit|organi[sz]e|execute)\s+(a|an)\s+(mass shooting|terror(ist)? attack|massacre|school shooting|bombing)\b", _I),
    ],
    "malware": [
        re.compile(
            r"\b(write|create|build|code|develop|make)\s+(me\s+|us\s+)?(a|an|some|working|functional|undetectable)\s+"
            r"(working\s+|functional\s+|undetectable\s+|python\s+|simple\s+)?(ransomware|keylogger|malware|computer virus|botnet|credential stealer|infostealer|rootkit|phishing kit)\b",
            _I,
        ),
    ],
    "hate": [
        re.compile(r"\b(jews|muslims|christians|black people|blacks|asians|hispanics|latinos|gay people|gays|trans people|women|immigrants|disabled people)\s+(are|is)\s+(inferior|subhuman|vermin|animals|parasites|a disease)\b", _I),
        re.compile(r"\b(exterminate|genocide (of|against)|eradicate|ethnically cleanse)\s+(all\s+|the\s+)?(jews|muslims|christians|blacks|asians|gays|trans people|immigrants)\b", _I),
    ],
    "harassment": [
        re.compile(r"\b(help me|i want to|how (do i|to|can i))\s+dox+\b", _I),
        re.compile(r"\b(find|get|leak|post)\s+[^.\n]{0,20}\b(home address|personal phone number|social security number)\s+of\b", _I),
    ],
    "fraud": [
        re.compile(r"\b(write|create|generate|make)\s+(me\s+)?(\d+\s+)?(fake|forged|counterfeit)\s+(customer\s+)?(reviews?|testimonials?|ids?|passports?|diplomas?|invoices?|receipts?)\b", _I),
        re.compile(r"\b(write|create|draft|make)\s+(me\s+)?(a|an)\s+(convincing\s+)?(phishing (email|message|page|site)|scam (email|text))\b", _I),
        re.compile(r"\bimpersonate (a|the) (bank|irs|paypal|police)\b", _I),
    ],
}

POLICY_LABELS = {
    "sexual_minors": "sexual content involving minors",
    "weapons": "instructions for weapons",
    "drugs": "instructions for making drugs",
    "self_harm": "self-harm",
    "violent_extremism": "violent extremism",
    "malware": "malicious software",
    "hate": "hate speech",
    "harassment": "harassment or doxxing",
    "fraud": "fraud or deception",
    "classifier": "unsafe content",
}


@dataclass
class ModerationResult:
    categories: list[str] = field(default_factory=list)

    @property
    def blocked(self) -> bool:
        return bool(self.categories)

    def describe(self) -> str:
        return ", ".join(POLICY_LABELS.get(c, c) for c in self.categories)


def moderate(text: str, *, use_classifier: bool = False, role: str = "user") -> ModerationResult:
    text = normalize(text)
    result = ModerationResult([name for name, patterns in POLICY.items() if any(p.search(text) for p in patterns)])
    if not result.blocked and use_classifier and config.GUARD_MODEL and text.strip():
        if classifier_flags(text, role):
            result.categories.append("classifier")
    return result


# ---- optional safety classifier ---------------------------------------------------------

_guard_down_until = 0.0


def classifier_flags(text: str, role: str = "user") -> bool:
    """True when the guard model says unsafe. Fails open (rules still apply) if it is down."""
    global _guard_down_until
    if time.monotonic() < _guard_down_until:
        return False
    try:
        from langchain_core.messages import AIMessage, HumanMessage
        from langchain_ollama import ChatOllama

        guard = ChatOllama(model=config.GUARD_MODEL, temperature=0, num_predict=12, keep_alive="30m", client_kwargs={"timeout": 30})
        messages = [HumanMessage(text[:6000])] if role == "user" else [HumanMessage("Write this."), AIMessage(text[:6000])]
        verdict = str(guard.invoke(messages).content).strip().lower()
        return verdict.startswith("unsafe")
    except Exception:
        log.warning("guard model %s is unavailable; using rules only for 5 minutes", config.GUARD_MODEL, exc_info=True)
        _guard_down_until = time.monotonic() + 300
        return False
