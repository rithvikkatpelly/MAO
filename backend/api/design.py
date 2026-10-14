"""The AI design studio: query -> topics -> content slide by slide -> style and design ideas ->
free-form HTML pages -> PDF and PNG.

Every step streams progress (SSE, same shape as the other pipelines) and runs through the
guardrails: admission and quotas, input and semantic checks, fenced research, guarded model calls,
HTML sanitizing, and a render-and-measure check on every page (the prompts' verify step).
"""

import re
import threading
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field, StringConstraints, create_model

from agents._web import format_sources, top_sources
from api.auth import current_user
from api.profile import brand_profile_for
from design import render
from design.formats import FORMAT_IDS, FORMATS, default_roles
from design.prompts import content_prompt, html_prompt, outline_prompt, topics_prompt
from design.sanitize import clean_html, visible_text
from design.styles import STYLE_IDS, STYLES, fonts_url, style_css
from guardrails import ratelimit, runctx
from guardrails.errors import GuardrailViolation
from guardrails.grounding import unsupported_numbers
from guardrails.jobs import admit, assist, stream_job
from guardrails.semantic import screen
from guardrails.validators import check_data, check_instruction
from llm import invoke_html, invoke_structured
from text_rules import clean

router = APIRouter(prefix="/api/design", tags=["design"])

Format = Literal[FORMAT_IDS]  # type: ignore[valid-type]
Style = Literal[STYLE_IDS]  # type: ignore[valid-type]


def _s(n: int):
    return Annotated[str, StringConstraints(max_length=n)]


# ---- catalog ------------------------------------------------------------------------------------


@router.get("/catalog")
def catalog():
    """Formats and styles for the studio, with each style's CSS per format for previews."""
    return {
        "formats": {k: {key: v[key] for key in ("label", "description", "unit", "width", "height", "count")} for k, v in FORMATS.items()},
        "styles": {
            k: {
                "name": v["name"],
                "mood": v["mood"],
                "best_for": v["best_for"],
                "swatches": v["swatches"],
                "fonts_url": fonts_url(k),
                "css": {f: style_css(k, FORMATS[f]["width"], FORMATS[f]["height"]) for f in FORMATS},
            }
            for k, v in STYLES.items()
        },
        "font_awesome": render.FONT_AWESOME,
    }


# ---- 1. topics ------------------------------------------------------------------------------------


class Topic(BaseModel):
    title: str = Field(max_length=90)
    angle: str = Field(max_length=220)
    why: str = Field(default="", max_length=180)


class TopicList(BaseModel):
    topics: list[Topic] = Field(min_length=3, max_length=5)


class TopicsRequest(BaseModel):
    query: Annotated[str, StringConstraints(min_length=2, max_length=500)]
    format: Format  # type: ignore[valid-type]
    audience: _s(200) = ""


@router.post("/topics")
def topics(req: TopicsRequest, user: dict = Depends(current_user)):
    query = check_instruction(req.query, "request", max_chars=500)
    audience = check_instruction(req.audience, "audience", max_chars=200)
    admission = admit(user["id"], "research", "design.topics")

    def job(emit, _cancelled) -> dict:
        emit("safety", "running")
        screen(f"{query}\n{audience}", "request")
        emit("safety", "done")
        emit("research", "running")
        sources = _research(query, " ".join(query.split()[:6]))
        emit("research", "done")
        emit("topics", "running")
        result = invoke_structured(TopicList, topics_prompt(query, req.format, format_sources(sources), audience), temperature=0.6, max_tokens=900)
        emit("topics", "done")
        return {"topics": clean([t.model_dump() for t in result.topics]), "sources": _public_sources(sources)}

    return stream_job(job, admission, max_calls=4)


def _research(*queries: str) -> list[dict]:
    """Web sources for the first query that finds any. Long, specific queries often find nothing,
    so shorter ones follow. With no sources at all the content is written without numbers."""
    for q in queries:
        q = (q or "").strip()
        if not q:
            continue
        try:
            return top_sources(q[:200])
        except RuntimeError:
            continue
    runctx.warn("No web sources were found for this topic, so the content leaves out numbers. Add facts in your notes if you have them.")
    return []


def _public_sources(sources: list[dict]) -> list[dict]:
    return [{"title": s["title"], "url": s["url"], "date": s.get("date", "")} for s in sources]


# ---- 2. content, unit by unit ------------------------------------------------------------------------


class Point(BaseModel):
    label: str = Field(max_length=40)
    text: str = Field(max_length=220)


class Number(BaseModel):
    value: str = Field(max_length=20)
    meaning: str = Field(max_length=110)
    source: int = Field(default=0, ge=0, le=10)


class UnitContent(BaseModel):
    headline: str = Field(max_length=90)
    subtitle: str = Field(default="", max_length=110, description="the point, one short line")
    points: list[Point] = Field(default_factory=list, max_length=5)
    numbers: list[Number] = Field(default_factory=list, max_length=4)
    details: list[Annotated[str, StringConstraints(max_length=120)]] = Field(default_factory=list, max_length=6)
    visual: str = Field(default="", max_length=200)
    takeaway: str = Field(default="", max_length=150)
    cta: str = Field(default="", max_length=140)
    notes: str = Field(default="", max_length=600)


class TopicIn(BaseModel):
    title: _s(120)
    angle: _s(300) = ""


class ContentRequest(BaseModel):
    query: _s(500) = ""
    topic: TopicIn
    format: Format  # type: ignore[valid-type]
    count: int = Field(default=0, ge=0, le=20)
    audience: _s(200) = ""
    notes: _s(2000) = ""


def _count(fmt: str, requested: int) -> int:
    c = FORMATS[fmt]["count"]
    return max(c["min"], min(c["max"], requested or c["default"]))


def _outline_schema(n: int):
    unit = create_model("PlannedUnit", headline=(str, Field(max_length=90)), point=(str, Field(max_length=200)))
    return create_model("Outline", title=(str, Field(max_length=90)), units=(list[unit], Field(min_length=n, max_length=n)))


@router.post("/content")
def content(req: ContentRequest, user: dict = Depends(current_user)):
    topic = {"title": check_instruction(req.topic.title, "topic"), "angle": check_instruction(req.topic.angle, "topic")}
    audience = check_instruction(req.audience, "audience", max_chars=200)
    n = _count(req.format, req.count)
    roles = default_roles(req.format, n)
    admission = admit(user["id"], "research", "design.content")

    def job(emit, cancelled: threading.Event) -> dict:
        emit("safety", "running")
        notes = check_data(req.notes, "your notes")
        screen(f"{req.query}\n{topic['title']}: {topic['angle']}\n{audience}\n{notes[:1500]}", "topic")
        emit("safety", "done")

        emit("research", "running")
        sources = _research(topic["title"], req.query, f"{topic['title']} {req.query}")
        facts = format_sources(sources) if sources else "(No web sources were found. Use only what the creator wrote; leave out numbers.)"
        evidence = "\n".join(f"{s['title']} {s.get('snippet', '')}" for s in sources) + f"\n{req.query}\n{notes}"
        emit("research", "done", data={"sources": _public_sources(sources)})

        emit("outline", "running")
        plan = invoke_structured(_outline_schema(n), outline_prompt(req.format, topic, roles, facts, audience, notes), temperature=0.4, max_tokens=150 + 60 * n)
        outline = clean([u.model_dump() for u in plan.units])
        emit("outline", "done", data={"title": clean(plan.title), "outline": outline, "roles": roles})

        units = []
        used: list[str] = []  # numbers already shown, so the same stat is not repeated on every page
        for i, role in enumerate(roles):
            if cancelled.is_set():
                break
            emit("content", "running", detail=f"Writing {FORMATS[req.format]['unit']} {i + 1} of {n}")
            written = invoke_structured(UnitContent, content_prompt(req.format, topic, outline, i, role, facts, audience, notes, used), temperature=0.4, max_tokens=900)
            unit = {"role": role, "content": clean(written.model_dump())}
            if role not in ("cover", "closing", "back"):  # covers and summaries may repeat the headline stat
                unit["content"]["numbers"] = [x for x in unit["content"]["numbers"] if x["value"] not in used]
            used += [x["value"] for x in unit["content"]["numbers"] if x["value"] not in used]
            missing = unsupported_numbers(_content_strings(unit["content"]), evidence)
            if missing:
                unit["warnings"] = ["Check these numbers against your sources: " + ", ".join(missing[:4]) + "."]
            units.append(unit)
            emit("content", "running", detail=f"Wrote {i + 1} of {n}", data={"index": i, "unit": unit})
        emit("content", "done")
        return {"title": clean(plan.title), "topic": topic, "units": units, "sources": _public_sources(sources)}

    return stream_job(job, admission, max_calls=4 + n, seconds=300 + 60 * n)


def _content_strings(c: dict) -> list[str]:
    out = [c.get(k, "") for k in ("headline", "subtitle", "takeaway", "cta")]
    out += [f"{p.get('label', '')} {p.get('text', '')}" for p in c.get("points", [])]
    out += [f"{x.get('value', '')} {x.get('meaning', '')}" for x in c.get("numbers", [])]
    return [s for s in out if s]


# ---- 3. design: HTML unit by unit ---------------------------------------------------------------------


class UnitIn(BaseModel):
    role: _s(20) = "body"
    content: UnitContent
    html: _s(20000) = ""


class Meta(BaseModel):
    author: _s(60) = ""
    brand: _s(60) = ""


class GenerateRequest(BaseModel):
    format: Format  # type: ignore[valid-type]
    style: Style  # type: ignore[valid-type]
    title: _s(120) = ""
    design_ideas: _s(600) = ""
    units: list[UnitIn] = Field(min_length=1, max_length=20)
    meta: Meta = Field(default_factory=Meta)


MAX_DESIGN_TOKENS = 2400


def _meta(user: dict, meta: Meta) -> dict:
    """Author and brand for the frame: what the creator typed, else their brand kit and name."""
    profile = brand_profile_for(user["id"]) or {}
    brand = meta.brand or (profile.get("voice") or {}).get("brand_name", "")
    return {"author": check_instruction(meta.author or user.get("name", ""), "author name", max_chars=60, classifier=False),
            "brand": check_instruction(brand, "brand", max_chars=60, classifier=False)}


_MAIN = re.compile(r'class="(body|cover)(?=[\s"])')


def _evidence(unit: dict) -> str:
    return " ".join(_content_strings(unit["content"])) + " " + " ".join(unit["content"].get("details", []))


def _score(metrics: dict, invented: list[str]) -> int:
    return metrics.get("overflowY", 0) * 3 + metrics.get("overflowX", 0) * 3 + metrics.get("empty", 0) + 150 * len(invented)


def _final_pass(b, fmt: str, style: str, i: int, total: int, html: str, meta: dict, metrics: dict, role: str):
    """Small, deterministic fixes the model could not make: tighten spacing when a page runs up to
    60 px long, spread the blocks evenly when it has a hole. Kept only if the page measures better."""
    overflow, empty = metrics.get("overflowY", 0), metrics.get("empty", 0)
    if 6 < overflow <= 60:
        fixed = _MAIN.sub(lambda m: f'class="{m.group(1)} tight', html, count=1)
    elif overflow <= 6 and empty > 60 and FORMATS[fmt]["height"]:
        fixed = _MAIN.sub(lambda m: f'class="{m.group(1)} spread', html, count=1)
    else:
        return html, render.frame(fmt, html, i, total, meta), metrics
    page = render.frame(fmt, fixed, i, total, meta)
    after = render.check_layout(b, fmt, style, page)
    if fixed != html and after.get("overflowY", 0) <= max(6, overflow - 6) and after.get("overflowX", 0) <= metrics.get("overflowX", 0):
        if overflow <= 6:  # spread: the space is now shared between blocks, which reads as intended
            after = {**after, "empty": 0}
        return fixed, page, after
    return html, render.frame(fmt, html, i, total, meta), metrics


def _design_unit(b, fmt: str, style: str, i: int, total: int, unit: dict, meta: dict, ideas: str, instruction: str = "", current: str = "") -> dict:
    """Write one unit's HTML, render it, and retry once with concrete feedback if the layout is off
    or the page shows numbers the content does not have; then a final deterministic layout pass."""
    feedback = ""
    best = None
    evidence = _evidence(unit)
    for attempt in range(2):
        prompt = html_prompt(fmt, style, i, total, unit["role"], unit["content"], meta, ideas, feedback=feedback, instruction=instruction, current_html=current)
        html = clean_html(invoke_html(prompt, temperature=0.4 if attempt == 0 else 0.5, max_tokens=MAX_DESIGN_TOKENS), i)
        if not html:
            feedback = "The reply had no HTML. Output only the HTML for the page."
            continue
        page = render.frame(fmt, html, i, total, meta)
        metrics = render.check_layout(b, fmt, style, page)
        invented = unsupported_numbers([visible_text(html)], evidence)
        feedback = render.layout_feedback(fmt, metrics, unit["role"])
        if invented:
            feedback += f" Remove these numbers, they are not in the content: {', '.join(invented[:5])}. Never copy numbers or text from the example."
        score = _score(metrics, invented)
        if best is None or score < best[0]:
            best = (score, html, page, metrics)
        if not feedback.strip():
            break
    if best is None:
        raise GuardrailViolation(502, "The AI could not design this page. Try again or simplify its content.", "design_empty")
    _, html, page, metrics = best
    html, page, metrics = _final_pass(b, fmt, style, i, total, html, meta, metrics, unit["role"])
    result = {"html": html, "page": page, "check": metrics, "warnings": []}
    left = render.layout_feedback(fmt, metrics, unit["role"])
    if left:
        result["warnings"].append("This page may need a manual tweak: " + left)
    # Numbers the design shows that the written content did not have.
    missing = unsupported_numbers([visible_text(html)], evidence)
    if missing:
        result["warnings"].append("The design shows numbers that are not in your content, check them: " + ", ".join(missing[:5]) + ".")
    return result


@router.post("/generate")
def generate(req: GenerateRequest, user: dict = Depends(current_user)):
    ideas = check_instruction(req.design_ideas, "design ideas", max_chars=600)
    meta = _meta(user, req.meta)
    units = [u.model_dump() for u in req.units][: FORMATS[req.format]["count"]["max"]]
    admission = admit(user["id"], "design", "design.generate")  # one of the creator's daily designs

    def job(emit, cancelled: threading.Event) -> dict:
        emit("safety", "running")
        text = "\n".join(visible_text(" ".join(f"{k}: {v}" for k, v in u["content"].items() if isinstance(v, str))) for u in units)
        check_data(text, "the content")
        screen(f"{req.title}\n{ideas}\n{text[:2500]}", "design")
        emit("safety", "done")
        out = []
        with render.browser() as b:
            for i, unit in enumerate(units):
                if cancelled.is_set():
                    break
                emit("design", "running", detail=f"Designing {FORMATS[req.format]['unit']} {i + 1} of {len(units)}")
                designed = _design_unit(b, req.format, req.style, i, len(units), unit, meta, ideas)
                out.append({**unit, **designed})
                emit("design", "running", detail=f"Designed {i + 1} of {len(units)}", data={"index": i, "unit": out[-1]})
        emit("design", "done")
        return {"format": req.format, "style": req.style, "meta": meta, "units": out}

    # two attempts per unit plus the safety check; about a minute per unit on the local model
    return stream_job(job, admission, max_calls=2 * len(units) + 3, seconds=240 + 120 * len(units))


# ---- 4. change one unit -----------------------------------------------------------------------------------


class UnitEditRequest(BaseModel):
    format: Format  # type: ignore[valid-type]
    style: Style  # type: ignore[valid-type]
    index: int = Field(ge=0, le=19)
    total: int = Field(ge=1, le=20)
    unit: UnitIn
    instruction: _s(600) = ""
    design_ideas: _s(600) = ""
    meta: Meta = Field(default_factory=Meta)


@router.post("/unit")
def edit_unit(req: UnitEditRequest, user: dict = Depends(current_user)):
    """Redesign one page: with an instruction ("make it more visual"), or from edited content."""
    instruction = check_instruction(req.instruction, "request", max_chars=600)
    ideas = check_instruction(req.design_ideas, "design ideas", max_chars=600)
    meta = _meta(user, req.meta)
    with assist(user["id"], "design.unit", max_calls=4):
        unit = req.unit.model_dump()
        text = visible_text(" ".join(str(v) for v in unit["content"].values() if isinstance(v, str)))
        check_data(text, "the content")
        screen(f"{instruction}\n{text[:2000]}", "request")
        current = clean_html(unit.get("html", ""), req.index)
        with render.browser() as b:
            designed = _design_unit(b, req.format, req.style, req.index, req.total, unit, meta, ideas, instruction=instruction, current=current)
        ctx = runctx.current()
        warnings = [*(ctx.warnings if ctx else []), *designed.pop("warnings", [])]
        return {**unit, **designed, "warnings": warnings}


# ---- 5. export -----------------------------------------------------------------------------------------------


class ExportUnit(BaseModel):
    html: _s(20000)


class ExportRequest(BaseModel):
    format: Format  # type: ignore[valid-type]
    style: Style  # type: ignore[valid-type]
    kind: Literal["pdf", "png"]
    title: _s(120) = "design"
    units: list[ExportUnit] = Field(min_length=1, max_length=20)
    meta: Meta = Field(default_factory=Meta)


@router.post("/export")
def export(req: ExportRequest, user: dict = Depends(current_user)):
    ratelimit.hit(user["id"], "export")
    meta = {"author": req.meta.author, "brand": req.meta.brand}
    data, media, ext = render.export_files(req.format, req.style, [u.model_dump() for u in req.units], meta, req.kind)
    name = re.sub(r"[^A-Za-z0-9]+", "-", req.title).strip("-").lower()[:60] or "design"
    return Response(content=data, media_type=media, headers={"Content-Disposition": f'attachment; filename="{name}.{ext}"', "Cache-Control": "no-store"})


@router.get("/preview/{style}/{fmt}")
def preview_css(style: Style, fmt: Format):  # type: ignore[valid-type]
    return {"css": style_css(style, FORMATS[fmt]["width"], FORMATS[fmt]["height"]), "fonts_url": fonts_url(style)}

