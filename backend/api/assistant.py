"""The editor assistant: chat to edit a generated carousel, deck, or infographic.

The creator writes what they want ("make every slide punchier", "turn slide 3 into a timeline",
"add a slide with an example", "use a darker template"). The model answers with a short reply and
a list of edit operations from a fixed set. The server checks every operation (slide numbers,
limits, templates, colors, diagram types) and the editor applies them as one undoable change.

The model never rewrites the project wholesale, so it cannot silently drop slides, designs, or
images it was not asked to touch.
"""

import re
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, StringConstraints

from agents.visual_tools import CATALOG_PROMPT, ICONS, TYPE_IDS, TYPES
from api.ai import _voice
from api.auth import current_user
from guardrails import runctx
from guardrails.grounding import unsupported_numbers
from guardrails.jobs import assist
from guardrails.semantic import screen
from guardrails.tokens import estimate_tokens, fit_history
from guardrails.untrusted import fence
from guardrails.validators import check_data, check_instruction
from llm import invoke_structured
from text_rules import STYLE_RULE, clean

router = APIRouter(prefix="/api/ai", tags=["ai"])

MAX_SLIDES = 20
HISTORY_TOKENS = 1200  # earlier turns sent to the model; the project itself is always sent in full


def _s(n: int):
    return Annotated[str, StringConstraints(max_length=n)]


# ---- request -------------------------------------------------------------------------------


class VisualItemIn(BaseModel):
    label: _s(80) = ""
    detail: _s(200) = ""
    value: _s(30) = ""


class VisualIn(BaseModel):
    type: _s(20) = ""
    items: list[VisualItemIn] = Field(default_factory=list, max_length=12)
    extra: dict[_s(20), _s(80)] = Field(default_factory=dict, max_length=8)


class SlideIn(BaseModel):
    kicker: _s(80) = ""
    headline: _s(300) = ""
    body: _s(1500) = ""
    notes: _s(1500) = ""
    role: _s(20) = ""
    visual: VisualIn | None = None


class EditProject(BaseModel):
    title: _s(200) = ""
    kind: Literal["carousel", "poster", "image", "thumbnail", "deck", "infographic"]
    slides: list[SlideIn] = Field(min_length=1, max_length=MAX_SLIDES)
    caption: _s(3000) = ""
    cta: _s(200) = ""
    hashtags: list[_s(40)] = Field(default_factory=list, max_length=30)
    template: _s(30) = ""
    accent: _s(9) = ""
    sources: list[_s(300)] = Field(default_factory=list, max_length=10)


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: _s(2000)


TemplateId = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z-]{0,29}$")]


class EditRequest(BaseModel):
    message: Annotated[str, StringConstraints(min_length=1, max_length=1000)]
    history: list[Turn] = Field(default_factory=list, max_length=20)
    project: EditProject
    active_slide: int = Field(default=1, ge=1, le=MAX_SLIDES)
    templates: list[TemplateId] = Field(default_factory=list, max_length=20)
    max_slides: int = Field(default=MAX_SLIDES, ge=1, le=MAX_SLIDES)


# ---- model output ---------------------------------------------------------------------------

Icon = Literal[ICONS]  # type: ignore[valid-type]
VisualType = Literal[TYPE_IDS]  # type: ignore[valid-type]


class OpItem(BaseModel):
    label: str = Field(max_length=40, description="2 to 4 words")
    detail: str = Field(default="", max_length=100, description="one short line, or empty")
    value: str = Field(default="", max_length=16, description="a number or date from the content, or empty")
    icon: Icon | None = None  # type: ignore[valid-type]


class Operation(BaseModel):
    op: Literal["update_slide", "add_slide", "delete_slide", "move_slide", "set_visual", "update_post", "update_design"]
    slide: int | None = Field(default=None, description="1-based slide number from the current numbering. For add_slide: the new slide goes after this one, 0 puts it first.")
    to: int | None = Field(default=None, description="move_slide only: the slide's new 1-based position")
    kicker: str | None = Field(default=None, max_length=40, description="small label above the headline")
    headline: str | None = Field(default=None, max_length=120)
    body: str | None = Field(default=None, max_length=400)
    notes: str | None = Field(default=None, max_length=600, description="decks only: what the presenter says")
    visual_type: VisualType | None = None  # type: ignore[valid-type]
    items: list[OpItem] | None = Field(default=None, max_length=10)
    center: str | None = Field(default=None, max_length=40, description="hub diagrams: the central idea")
    left_title: str | None = Field(default=None, max_length=30, description="comparison diagrams")
    right_title: str | None = Field(default=None, max_length=30, description="comparison diagrams")
    caption: str | None = Field(default=None, max_length=2200)
    cta: str | None = Field(default=None, max_length=150)
    add_hashtags: list[Annotated[str, StringConstraints(max_length=30)]] | None = Field(default=None, max_length=10, description="hashtags to add, without #")
    remove_hashtags: list[Annotated[str, StringConstraints(max_length=30)]] | None = Field(default=None, max_length=30, description="existing hashtags to remove, without #")
    template: str | None = Field(default=None, max_length=30)
    accent: str | None = Field(default=None, max_length=9, description="#RRGGBB")


class EditPlan(BaseModel):
    reply: str = Field(max_length=400, description="one or two sentences telling the creator what you changed, or one short question if the request is unclear")
    operations: list[Operation] = Field(default_factory=list, max_length=40)


# ---- prompt ------------------------------------------------------------------------------------

KIND_LABELS = {
    "carousel": "carousel",
    "poster": "poster",
    "image": "social image",
    "thumbnail": "thumbnail",
    "deck": "presentation",
    "infographic": "infographic",
}
STUDIO = {"deck", "infographic"}


def _visual_text(v: VisualIn) -> str:
    items = "; ".join(" ".join(x for x in (f"[{i.value}]" if i.value else "", i.label, f"({i.detail})" if i.detail else "") if x) for i in v.items)
    extra = ", ".join(f"{k}: {val}" for k, val in v.extra.items() if val)
    return f"diagram {v.type or 'none'}: {items}" + (f" | {extra}" if extra else "")


def _project_text(p: EditProject) -> str:
    lines = [f"Title: {p.title}"]
    for n, s in enumerate(p.slides, start=1):
        parts = [f"Slide {n}" + (f" ({s.role})" if s.role and s.role != "page" else "") + ":"]
        if s.kicker:
            parts.append(f"label: {s.kicker}")
        parts.append(f"headline: {s.headline}")
        if s.body:
            parts.append(f"body: {s.body}")
        if s.visual and s.visual.type:
            parts.append(_visual_text(s.visual))
        if s.notes:
            parts.append(f"notes: {s.notes}")
        lines.append(" | ".join(parts))
    if p.kind not in STUDIO or p.caption:
        lines.append(f"Caption: {p.caption}")
    if p.cta:
        lines.append(f"Call to action: {p.cta}")
    if p.hashtags:
        lines.append("Hashtags: " + " ".join(p.hashtags))
    lines.append(f"Design: template {p.template or 'default'}, accent {p.accent or 'default'}")
    if p.sources:
        lines.append("Sources: " + "; ".join(p.sources))
    return "\n".join(lines)


def _history_text(history: list[Turn]) -> str:
    turns = [{"role": t.role, "content": t.content} for t in history]
    kept = fit_history(turns, HISTORY_TOKENS).kept
    return "\n".join(f"{'Creator' if t['role'] == 'user' else 'Assistant'}: {t['content']}" for t in kept)


def _prompt(req: EditRequest, project_text: str, voice: str) -> str:
    p = req.project
    n = len(p.slides)
    kind = KIND_LABELS[p.kind]
    multi = req.max_slides > 1
    rules = [
        "Return the operations that make exactly the requested change. Leave everything else as it is.",
        f"Slide numbers refer to the numbering above (1 to {n}), even when you add, delete, or move slides in the same answer.",
        "update_slide: give the slide number and only the fields that change. When asked to rewrite, shorten, or sharpen, write genuinely new wording: repeating the current text is not a change.",
        "When the request covers several slides or the whole post, return one update_slide per slide.",
        "Punchier, sharper, or stronger means shorter sentences, concrete words, and active verbs, never extra sentences. Shorter means fewer words.",
        f"add_slide: slide is the slide it goes after (0 for the start); include headline and body. The {kind} can have at most {req.max_slides} slide(s)."
        if multi
        else f"This {kind} has exactly one slide. Never use add_slide, delete_slide, or move_slide.",
    ]
    if multi:
        rules.append("delete_slide and move_slide: use only when asked. Never delete every slide.")
    if p.kind in STUDIO:
        rules.append(
            "set_visual (not update_slide) changes a slide's diagram: the slide number, then visual_type and items. Items have a 2 to 4 word label, "
            "an optional short detail, a value only for a number or date that is in the content, and an icon. "
            f"Diagram types:\n{CATALOG_PROMPT}"
        )
        rules.append("notes are what the presenter says aloud; change them only when asked or when you rewrite a slide's point.")
        rules.append("A slide with a diagram keeps a short body or none. Never copy the diagram's items into the body.")
        rules.append("Timeline and number values must come from the content. When it has no dates or numbers, leave value empty instead of making them up.")
    else:
        rules.append("Do not use set_visual for this format.")
    rules.append("update_post: caption (no hashtags in it), cta, add_hashtags for new hashtags, remove_hashtags for ones to drop (without the # symbol). The hashtags you do not mention are kept.")
    templates = ", ".join(req.templates) if req.templates else "the current one"
    rules.append(f"update_design: template must be one of: {templates}. accent is a hex color like #1E40AF.")
    rules.append("Never invent numbers, names, dates, quotes, or facts that are not in the content above or in the request.")
    rules.append("If the request is unclear or cannot be done with these operations, return no operations and ask one short question in reply.")
    rules.append("reply: one or two sentences, in plain words, saying what you changed.")

    history = _history_text(req.history)
    return (
        f"{voice}\n\nYou are the editing assistant inside Aurea. The creator is editing this {kind} and is looking at slide {min(req.active_slide, n)}.\n\n"
        f"Current {kind}:\n{fence('project', project_text)}\n\n"
        + (f"Earlier in this chat:\n{fence('chat_history', history)}\n\n" if history else "")
        + f"The creator's request: {req.message}\n\n"
        + "How to answer:\n- "
        + "\n- ".join(rules)
        + "\n"
        + STYLE_RULE
    )


# ---- checking the plan ------------------------------------------------------------------------

_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
_TEXT_FIELDS = ("kicker", "headline", "body", "notes")


def _checked(plan: EditPlan, req: EditRequest) -> tuple[list[dict], list[str]]:
    """Operations the editor can apply safely. Anything out of range or not allowed is dropped."""
    p = req.project
    n = len(p.slides)
    multi = req.max_slides > 1
    studio = p.kind in STUDIO
    ops: list[dict] = []
    notes: list[str] = []
    deleted: set[int] = set()
    added = 0

    raw_ops = []
    for op in plan.operations:
        d = op.model_dump(exclude_none=True)
        # Small models sometimes put diagram fields on a text update: treat them as a diagram change.
        if d["op"] == "update_slide" and (d.get("visual_type") or d.get("items")):
            raw_ops.append({k: v for k, v in d.items() if k in ("slide", "visual_type", "items", "center", "left_title", "right_title")} | {"op": "set_visual"})
        raw_ops.append(d)

    for d in raw_ops:
        kind = d["op"]
        slide = d.get("slide")
        in_range = isinstance(slide, int) and 1 <= slide <= n

        if kind == "update_slide":
            if not in_range:
                continue
            current = p.slides[slide - 1]
            # only fields that actually change
            fields = {k: d[k] for k in _TEXT_FIELDS if k in d and d[k].strip() != getattr(current, k).strip()}
            if not studio:
                fields.pop("notes", None)
            if not fields:
                continue
            ops.append({"op": kind, "slide": slide, **fields})
        elif kind == "add_slide":
            after = slide if isinstance(slide, int) and 0 <= slide <= n else n
            if not multi or n + added - len(deleted) >= req.max_slides or not d.get("headline"):
                continue
            added += 1
            ops.append({"op": kind, "slide": after, **{k: d[k] for k in _TEXT_FIELDS if k in d}})
        elif kind == "delete_slide":
            if not multi or not in_range or slide in deleted or n + added - len(deleted) <= 1:
                continue
            deleted.add(slide)
            ops.append({"op": kind, "slide": slide})
        elif kind == "move_slide":
            to = d.get("to")
            if not multi or not in_range or not isinstance(to, int) or not 1 <= to <= n or to == slide:
                continue
            ops.append({"op": kind, "slide": slide, "to": to})
        elif kind == "set_visual":
            if not studio or not in_range or not (d.get("visual_type") or d.get("items")):
                continue
            vtype = d.get("visual_type") or (p.slides[slide - 1].visual.type if p.slides[slide - 1].visual else "") or "iconlist"
            items = d.get("items")
            if items is not None:
                items = items[: TYPES[vtype]["max"]] if vtype in TYPES else items
            extra = {k: d[k] for k in ("center", "left_title", "right_title") if k in d}
            ops.append({"op": kind, "slide": slide, "visual_type": vtype, **({"items": items} if items is not None else {}), **({"extra": extra} if extra else {})})
        elif kind == "update_post":
            fields = {k: d[k] for k in ("caption", "cta") if k in d and d[k].strip() != getattr(p, k).strip()}
            have = {h.lower().lstrip("#") for h in p.hashtags}
            add = [h for h in d.get("add_hashtags", []) if h.lower().lstrip("#") not in have]
            remove = [h for h in d.get("remove_hashtags", []) if h.lower().lstrip("#") in have]
            if add:
                fields["add_hashtags"] = add
            if remove:
                fields["remove_hashtags"] = remove
            if fields:
                ops.append({"op": kind, **fields})
        elif kind == "update_design":
            fields = {}
            if d.get("template") in req.templates and d["template"] != p.template:
                fields["template"] = d["template"]
            if d.get("accent") and _HEX.match(d["accent"]) and d["accent"].upper() != p.accent.upper():
                fields["accent"] = d["accent"].upper()
            if fields:
                ops.append({"op": kind, **fields})

    return clean(ops), notes


def _new_text(ops: list[dict]) -> list[str]:
    texts = []
    for op in ops:
        texts += [op.get(k, "") for k in ("kicker", "headline", "body", "notes", "caption", "cta")]
        texts += [f"{i.get('value', '')} {i.get('label', '')} {i.get('detail', '')}" for i in op.get("items", [])]
    return [t for t in texts if t]


# ---- route ---------------------------------------------------------------------------------------


@router.post("/edit")
def edit(req: EditRequest, user: dict = Depends(current_user)):
    message = check_instruction(req.message, "request", max_chars=1000)
    with assist(user["id"], "ai.edit", max_calls=6):
        project_text = check_data(_project_text(req.project), "the project")
        screen(f"{message}\n\n{project_text[:2500]}", "request")
        req = req.model_copy(update={"message": message})
        prompt = _prompt(req, project_text, _voice(user["id"]))
        max_tokens = min(2600, 500 + 160 * len(req.project.slides))
        plan = invoke_structured(EditPlan, prompt, temperature=0.3, max_tokens=max_tokens)
        ops, notes = _checked(plan, req)
        if not ops and any(o.op in ("update_slide", "update_post", "set_visual") for o in plan.operations):
            # The model answered with the current text unchanged. Ask once more, firmly.
            nudge = "\n\nYour last answer repeated the current text word for word, which changes nothing. Write new wording now."
            plan = invoke_structured(EditPlan, prompt + nudge, temperature=0.6, max_tokens=max_tokens)
            ops, notes = _checked(plan, req)
        missing = unsupported_numbers(_new_text(ops), f"{project_text}\n{message}")
        if missing:
            notes.append("Check these numbers, they were not in your content: " + ", ".join(missing[:5]) + ".")
        ctx = runctx.current()
        warnings = list(dict.fromkeys([*(ctx.warnings if ctx else []), *notes]))
        reply = clean(plan.reply) or ("Done." if ops else "I could not make that change. Try saying which slide and what to change.")
        return {"reply": reply, "operations": ops, "warnings": warnings, "prompt_tokens": estimate_tokens(prompt)}
