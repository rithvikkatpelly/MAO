"""Napkin-style visuals: a fixed catalog of diagram types and the AI steps that fill them.

The model never draws. For each slide or section it picks a type from the catalog and
fills a small, typed form for it (bounded item counts and text lengths). The frontend
renders every type in several variants (frontend/src/lib/visuals.jsx), and the catalog
is mirrored in frontend/src/lib/visualTypes.js.

Every visual is returned in one shape, so the editor can switch types without losing text:
    {"type", "variant", "items": [{"label", "detail", "value", "icon", "group"}], "extra": {...}, "alternates": [...]}
"""

import re
from collections import defaultdict
from typing import Annotated, Literal

from pydantic import BaseModel, Field, create_model

from llm import invoke_structured
from text_rules import STYLE_RULE, clean

# Icon keys the renderer knows (frontend/src/lib/slideIcons.js).
ICONS = (
    "lightbulb", "trending", "target", "rocket", "zap", "check", "star", "heart", "users", "chart",
    "clock", "calendar", "shield", "sparkles", "book", "message", "megaphone", "money", "globe", "code",
    "camera", "coffee", "trophy", "flame", "brain", "search", "settings", "layers", "flag", "link",
    "lock", "map", "puzzle", "gift", "leaf", "mail", "phone", "cloud", "database", "cart",
    "building", "school", "handshake", "eye", "compass", "bell", "repeat", "tools",
)
Icon = Literal[ICONS]  # type: ignore[valid-type]

# type -> label, item bounds, and when to use it (shown to the model)
TYPES: dict[str, dict] = {
    "process": {"label": "Process", "min": 3, "max": 6, "use": "the ordered steps of ONE sequence someone follows: a method, a how-to, a single workflow"},
    "timeline": {"label": "Timeline", "min": 3, "max": 6, "use": "events or phases in time order: history, a roadmap, milestones"},
    "cycle": {"label": "Cycle", "min": 3, "max": 6, "use": "a repeating loop where the last step leads back to the first"},
    "funnel": {"label": "Funnel", "min": 3, "max": 5, "use": "stages that narrow down, like awareness to purchase"},
    "pyramid": {"label": "Pyramid", "min": 3, "max": 5, "use": "levels that build on a foundation, top level first"},
    "iconlist": {"label": "Icon list", "min": 3, "max": 6, "use": "several separate things side by side: tips, benefits, features, reasons, or categories (even if each has steps of its own)"},
    "hub": {"label": "Hub and spoke", "min": 3, "max": 6, "use": "one central idea with the parts or pillars around it"},
    "stats": {"label": "Big numbers", "min": 2, "max": 4, "use": "2 to 4 headline numbers that appear in the facts"},
    "bars": {"label": "Bar chart", "min": 3, "max": 6, "use": "numbers from the facts compared across categories"},
    "comparison": {"label": "Comparison", "min": 4, "max": 10, "use": "two sides: A vs B, before and after, myth vs fact, pros and cons"},
    "matrix": {"label": "2x2 matrix", "min": 4, "max": 4, "use": "four options sorted on two axes"},
    "venn": {"label": "Venn", "min": 2, "max": 3, "use": "two or three overlapping ideas and what they share"},
}
TYPE_IDS = tuple(TYPES)
VisualType = Literal[TYPE_IDS]  # type: ignore[valid-type]
DATA_TYPES = ("stats", "bars")  # types whose numbers must come from the facts

DEFAULT_VARIANT = {
    "process": "chevrons", "timeline": "line", "cycle": "ring", "funnel": "stacked", "pyramid": "triangle",
    "iconlist": "grid", "hub": "spokes", "stats": "tiles", "bars": "horizontal", "comparison": "columns",
    "matrix": "grid", "venn": "filled",
}

CATALOG_PROMPT = "\n".join(f"- {k}: {v['use']}" for k, v in TYPES.items())


# ---- picking a type ------------------------------------------------------------------

_SIGNALS: list[tuple[str, str, float]] = [
    ("process", r"\b(step|first|then|next|finally|how to|method|workflow|process)\b", 2),
    ("timeline", r"\b(1[89]\d\d|20\d\d|history|roadmap|milestone|era|decade|phase|quarter|week \d|day \d)\b", 2),
    ("cycle", r"\b(cycle|loop|repeat|again|feedback|iterate|ongoing|habit)\b", 2),
    ("funnel", r"\b(funnel|narrow|convert|conversion|awareness|leads?|pipeline|drop.?off)\b", 2.5),
    ("pyramid", r"\b(pyramid|foundation|hierarchy|levels?|base|layers?|maslow|tier)\b", 2),
    ("comparison", r"\b(vs\.?|versus|compared|unlike|instead|before and after|myth|fact|pros?|cons?|old way|new way|do and don)\b", 2.5),
    ("matrix", r"\b(quadrant|matrix|2x2|axis|urgent|impact and effort|high and low)\b", 3),
    ("venn", r"\b(overlap|intersection|sweet spot|where .+ meet|both|in common)\b", 2),
    ("hub", r"\b(pillars?|components?|parts of|elements|ecosystem|framework|around)\b", 1.5),
    ("iconlist", r"\b(tips?|reasons?|ways|benefits?|features?|mistakes?|lessons?|signs)\b", 1.5),
]
_NUMBER = re.compile(r"(\$|€|£)?\d[\d,.]*\s?(%|percent|x\b|k\b|m\b|bn?\b|million|billion|times)?", re.I)


def numbers_in(text: str) -> list[str]:
    return [m.group(0).strip() for m in _NUMBER.finditer(text or "") if any(c.isdigit() for c in m.group(0))]


def suggest_types(text: str) -> list[str]:
    """Types ranked by simple text signals. Cheap hints for the model and the alternates list."""
    t = (text or "").lower()
    scores: dict[str, float] = defaultdict(float, {"iconlist": 1.0, "process": 0.6, "hub": 0.4})
    for vtype, pattern, weight in _SIGNALS:
        if re.search(pattern, t):
            scores[vtype] += weight
    stats = [n for n in numbers_in(t) if not re.fullmatch(r"(1[89]|20)\d\d", n)]
    if len(stats) >= 2:
        scores["stats"] += 2.2
        scores["bars"] += 1.6
    elif len(stats) == 1:
        scores["stats"] += 1.0
    return sorted(TYPE_IDS, key=lambda k: -scores[k])


def alternates_for(vtype: str, text: str, n: int = 3) -> list[str]:
    return [t for t in suggest_types(text) if t != vtype][:n]


class TypePick(BaseModel):
    type: VisualType  # type: ignore[valid-type]


def pick_type(text: str, voice: str = "") -> str:
    hints = ", ".join(suggest_types(text)[:3])
    pick = invoke_structured(
        TypePick,
        f"Choose the diagram type that best shows this content.\n\nCatalog:\n{CATALOG_PROMPT}\n\n"
        f"Content:\n{text[:1500]}\n\nLikely fits, from a quick scan: {hints}. "
        "Only choose stats or bars if the content contains real numbers.",
        temperature=0.1,
        max_tokens=60,
    )
    return pick.type


# ---- filling a type --------------------------------------------------------------------


class Item(BaseModel):
    label: str = Field(max_length=34, description="2 to 4 words")
    detail: str = Field(max_length=90, description="one short supporting line, under 12 words")
    icon: Icon  # type: ignore[valid-type]


class DatedItem(Item):
    value: str = Field(max_length=16, description="when: a year, date, or phase, like 2019, Q3, or Week 1")


class StatItem(BaseModel):
    value: str = Field(max_length=14, description="the number with its unit exactly as in the facts, like 73% or $4.2B")
    label: str = Field(max_length=40, description="what the number measures, 2 to 6 words")
    detail: str = Field(max_length=80, description="short context or source, under 10 words")
    icon: Icon  # type: ignore[valid-type]


class BarItem(BaseModel):
    label: str = Field(max_length=28, description="category name, 1 to 3 words")
    value: float = Field(description="the number for this category, taken from the facts")


def _items(model, lo: int, hi: int):
    return (list[model], Field(min_length=lo, max_length=hi))


def _schema(vtype: str) -> type[BaseModel]:
    lo, hi = TYPES[vtype]["min"], TYPES[vtype]["max"]
    name = f"{vtype.title()}Visual"
    if vtype == "timeline":
        return create_model(name, items=_items(DatedItem, lo, hi))
    if vtype == "stats":
        return create_model(name, items=_items(StatItem, lo, hi))
    if vtype == "bars":
        return create_model(
            name,
            items=_items(BarItem, lo, hi),
            suffix=(str, Field(max_length=6, description="unit shown after each value, like % or k, or empty")),
        )
    if vtype == "hub":
        return create_model(name, center=(str, Field(max_length=40, description="the central idea, 1 to 4 words")), items=_items(Item, lo, hi))
    if vtype == "comparison":
        side = (list[str], Field(min_length=2, max_length=5, description="2 to 5 short points, under 10 words each"))
        return create_model(
            name,
            left_title=(str, Field(max_length=30)),
            right_title=(str, Field(max_length=30)),
            left=side,
            right=side,
        )
    if vtype == "matrix":
        return create_model(
            name,
            x_axis=(str, Field(max_length=28, description="what the horizontal axis measures, low to high")),
            y_axis=(str, Field(max_length=28, description="what the vertical axis measures, low to high")),
            quadrants=(list[Item], Field(min_length=4, max_length=4, description="top left, top right, bottom left, bottom right")),
        )
    if vtype == "venn":
        return create_model(
            name,
            circles=_items(Item, 2, 3),
            overlap=(str, Field(max_length=40, description="what all circles share, 1 to 5 words")),
        )
    return create_model(name, items=_items(Item, lo, hi))


def _normalize(vtype: str, data: BaseModel) -> dict:
    """Any filled schema to the shared {items, extra} shape."""
    d = data.model_dump()
    item = lambda i, group=0: {"label": i.get("label", ""), "detail": i.get("detail", ""), "value": str(i.get("value", "") or ""), "icon": i.get("icon", ""), "group": group}  # noqa: E731
    extra: dict = {}
    if vtype == "comparison":
        items = [item({"label": p}, 0) for p in d["left"]] + [item({"label": p}, 1) for p in d["right"]]
        extra = {"left": d["left_title"], "right": d["right_title"]}
    elif vtype == "matrix":
        items = [item(q) for q in d["quadrants"]]
        extra = {"x_axis": d["x_axis"], "y_axis": d["y_axis"]}
    elif vtype == "venn":
        items = [item(c) for c in d["circles"]]
        extra = {"overlap": d["overlap"]}
    elif vtype == "bars":
        items = [item({**b, "value": f"{b['value']:g}"}) for b in d["items"]]
        extra = {"suffix": d.get("suffix", "")}
    else:
        items = [item(i) for i in d["items"]]
        if vtype == "hub":
            extra = {"center": d["center"]}
    return {"items": items, "extra": extra}


_TYPE_RULES = {
    "bars": "Every bar measures the same thing in the same unit. ",
    "stats": "Each number must appear in the facts, with its unit. ",
    "comparison": "Points on each side answer the same questions, in the same order. ",
    "timeline": "Items are in time order. ",
    "process": "Items are in the order someone does them. ",
}


def fill_visual(vtype: str, message: str, facts: str, voice: str = "", avoid: list[str] | None = None) -> dict:
    """One model call: the content for one visual of the given type, in the shared shape."""
    lo, hi = TYPES[vtype]["min"], TYPES[vtype]["max"]
    others = (
        "Other slides already cover these, so do not repeat them here: " + "; ".join(avoid) + ".\n" if avoid else ""
    )
    data = invoke_structured(
        _schema(vtype),
        f"{voice}\n\nYou are filling in a {TYPES[vtype]['label']} diagram ({TYPES[vtype]['use']}).\n"
        f"It shows only this point, broken into its parts: {message}\n{others}\nFacts you may use:\n{facts[:3500]}\n\n"
        f"Use {lo} to {hi} items. Labels are 2 to 4 words; details are one short line. {_TYPE_RULES.get(vtype, '')}"
        "Pick a fitting icon for each item. Use only facts given above and never invent numbers, "
        "names, or dates.\n" + STYLE_RULE,
        temperature=0.4,
        max_tokens=900,
    )
    return _normalize(vtype, data)


# ---- checks ----------------------------------------------------------------------------


def _digits(s: str) -> str:
    return re.sub(r"[^\d.]", "", s).strip(".")


def _as_iconlist(visual: dict) -> None:
    items = [{**i, "value": "", "detail": i["detail"] or i["label"]} for i in visual["items"]][: TYPES["iconlist"]["max"]]
    while len(items) < TYPES["iconlist"]["min"]:
        items.append({"label": "", "detail": "", "value": "", "icon": "check", "group": 0})
    visual.update(type="iconlist", variant=DEFAULT_VARIANT["iconlist"], extra={}, items=items)


def validate_visual(visual: dict, facts: str) -> dict:
    """Numbers must come from the facts, once each. A chart left too thin becomes big numbers,
    and big numbers left too thin become an icon list, so nothing is invented to fill space."""
    if visual["type"] in DATA_TYPES:
        known = {_digits(n) for n in numbers_in(facts)} - {""}
        kept, seen = [], set()
        for item in visual["items"]:
            d = _digits(item["value"])
            if d in known and d not in seen:
                seen.add(d)
                kept.append(item)
        visual["items"] = kept
        if visual["type"] == "bars" and len(kept) < TYPES["bars"]["min"]:
            unit = visual.get("extra", {}).get("suffix", "")
            unit = unit if len(unit) <= 3 and " " not in unit else ""
            for item in kept:
                item["value"] = f"{item['value']}{unit}"
            visual.update(type="stats", variant=DEFAULT_VARIANT["stats"], extra={})
        if visual["type"] == "stats" and len(kept) < TYPES["stats"]["min"]:
            _as_iconlist(visual)
    suffix = visual.get("extra", {}).get("suffix")
    if suffix is not None and (len(suffix) > 3 or " " in suffix):
        visual["extra"]["suffix"] = ""
    return clean(visual)


def build_visual(vtype: str, message: str, facts: str, voice: str = "", avoid: list[str] | None = None) -> dict:
    filled = fill_visual(vtype, message, facts, voice, avoid)
    visual = {"type": vtype, "variant": DEFAULT_VARIANT[vtype], **filled}
    visual = validate_visual(visual, facts)
    visual["alternates"] = alternates_for(visual["type"], message)
    return visual


# ---- outlines --------------------------------------------------------------------------

VisualOrNone = Literal[TYPE_IDS + ("none",)]  # type: ignore[valid-type]
Hashtag = Annotated[str, Field(max_length=30)]


class DeckSlide(BaseModel):
    role: Literal["title", "agenda", "section", "content", "summary", "cta"]
    kicker: str = Field(max_length=30, description="a 1 to 3 word label above the headline")
    headline: str = Field(max_length=80, description="the slide's single point, under 10 words")
    body: str = Field(max_length=300, description="one or two short sentences under 30 words, or empty when a visual carries the slide")
    notes: str = Field(max_length=450, description="the words the presenter says aloud on this slide, 2 to 4 sentences, never mentioning diagrams or design")
    visual: VisualOrNone = Field(description="the diagram type that shows this slide's content, or none")  # type: ignore[valid-type]


def _social_fields():
    return {
        "caption": (str, Field(max_length=220, description="a post caption to share it, under 35 words, no hashtags")),
        "hashtags": (list[Hashtag], Field(min_length=3, max_length=5, description="hashtags without #")),
    }


def deck_outline(n: int, brief: str, facts: str, voice: str, density: str):
    schema = create_model(
        "DeckOutline",
        title=(str, Field(max_length=80)),
        slides=(list[DeckSlide], Field(min_length=n, max_length=n)),
        **_social_fields(),
    )
    share = {"visual": "nearly every content slide", "balanced": "about half of the content slides", "text": "only a few slides"}[density]
    return invoke_structured(
        schema,
        f"{voice}\n\nPlan a {n}-slide presentation.\nBrief: {brief}\n\nFacts to build on:\n{facts[:4000]}\n\n"
        "Slide 1 is the title slide (role title, visual none). The last slide is a summary or a call to action. "
        "Every slide makes one point. Use a diagram on " + share + ", choosing the type that fits from:\n"
        f"{CATALOG_PROMPT}\nOnly use stats or bars when the facts contain the numbers. Choose each type from what that "
        "slide's content is, never for variety. "
        "When a slide has a diagram, keep its body short. Speaker notes are the words the presenter says aloud: "
        "talk to the audience and never mention diagrams, slides, or layout.\n" + STYLE_RULE,
        temperature=0.5,
        max_tokens=350 * n + 400,
    )


def infographic_plan(brief: str, facts: str, voice: str):
    """One infographic for the whole text (Napkin style): a short title and the one diagram type that fits it."""
    schema = create_model(
        "InfographicPlan",
        title=(str, Field(max_length=60, description="a short title for the diagram, 3 to 8 words")),
        visual=(VisualType, Field(description="the single diagram type that best shows the whole text")),  # type: ignore[valid-type]
        **_social_fields(),
    )
    return invoke_structured(
        schema,
        f"{voice}\n\nTurn this content into ONE diagram that captures all of it.\nBrief: {brief}\n\nContent:\n{facts[:4000]}\n\n"
        f"Choose the diagram type from what the content is:\n{CATALOG_PROMPT}\n"
        "Only use stats or bars when the content contains the numbers.\n" + STYLE_RULE,
        temperature=0.3,
        max_tokens=300,
    )


def finish_sentence(text: str) -> str:
    """Drop a trailing fragment when the model stopped mid-sentence at a length cap."""
    text = text.strip()
    if not text or text[-1] in ".!?":
        return text
    end = max(text.rfind(". "), text.rfind("! "), text.rfind("? "))
    return text[: end + 1] if end >= len(text) // 3 else text


def ensure_visuals(slides: list[dict], density: str) -> None:
    """In 'visual' density every content slide gets a diagram, picked by text signals if the model skipped it."""
    if density != "visual":
        return
    for s in slides:
        if s["role"] in ("content", "agenda", "summary") and s["visual"] == "none":
            s["visual"] = suggest_types(f"{s['headline']} {s['body']}")[0]
