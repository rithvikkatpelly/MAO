"""Presentation decks and Napkin-style infographics.

POST /generate streams progress (SSE, same event shape as the carousel pipeline):
    research   sources for a topic, or the creator's pasted text as the only source
    outline    decks: the storyline, with a diagram type per slide
               infographics: one title and the one diagram type for the whole text (Napkin style)
    visuals    one call per diagram to fill its typed form
    review     drop numbers that are not in the sources, clean house style
POST /visualize turns any text into one diagram (the editor's "Visualize" and "Regenerate").
"""

import re
import threading
from collections.abc import Callable
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, StringConstraints

from agents._web import format_sources, top_sources
from agents.visual_tools import (
    TYPE_IDS,
    build_visual,
    finish_sentence,
    deck_outline,
    ensure_visuals,
    infographic_plan,
    pick_type,
)
from api.ai import _voice
from api.auth import current_user
from guardrails.errors import GuardrailViolation
from guardrails.grounding import review_copy
from guardrails.jobs import admit, assist, stream_job
from guardrails.semantic import screen
from guardrails.untrusted import fence
from guardrails.validators import check_data, check_instruction
from text_rules import clean

router = APIRouter(prefix="/api/visuals", tags=["visuals"])

Short = Annotated[str, StringConstraints(max_length=300)]


class IdeaIn(BaseModel):
    title: Short = ""
    angle: Annotated[str, StringConstraints(max_length=600)] = ""


class GenerateRequest(BaseModel):
    format: Literal["deck", "infographic"]
    topic: Annotated[str, StringConstraints(max_length=500)] = ""
    text: Annotated[str, StringConstraints(max_length=12000)] = ""  # pasted notes: used instead of web research
    idea: IdeaIn | None = None
    count: int = Field(default=8, ge=1, le=15)  # slides in a deck (an infographic is always one diagram)
    density: Literal["visual", "balanced", "text"] = "balanced"


def _validated(req: GenerateRequest) -> GenerateRequest:
    """Topic and idea are instructions; pasted text is data (instruction-like passages removed)."""
    idea = None
    if req.idea:
        idea = IdeaIn(title=check_instruction(req.idea.title, "idea"), angle=check_instruction(req.idea.angle, "idea"))
    return req.model_copy(update={"topic": check_instruction(req.topic, "topic"), "idea": idea})


def _generate(req: GenerateRequest, user_id, emit: Callable[..., None]) -> dict:
    voice = _voice(user_id)
    text = check_data(req.text, "your pasted text").strip()  # inside the run, so removals become warnings
    brief = req.topic or (req.idea.title if req.idea else "") or text[:300]
    if req.idea and req.idea.title:
        brief = f"{req.idea.title}: {req.idea.angle}" + (f" (topic: {req.topic})" if req.topic else "")

    emit("safety", "running")
    screen(f"{brief}\n{text[:3000]}", "request")  # before any web search or generation
    emit("safety", "done")

    emit("research", "running")
    if text:
        facts, sources = fence("pasted_text", text), []
    else:
        if not brief.strip():
            raise GuardrailViolation(422, "Add a topic or paste some text first.", "empty")
        sources = top_sources(req.idea.title if req.idea and req.idea.title else brief)
        facts = format_sources(sources)
    emit("research", "done")

    emit("outline", "running")
    if req.format == "deck":
        count = max(5, req.count)
        outline = deck_outline(count, brief, facts, voice, req.density).model_dump()
        slides = outline["slides"]
        ensure_visuals(slides, req.density)
    else:
        outline = infographic_plan(brief, facts, voice).model_dump()
        slides = [{"role": "page", "kicker": "", "headline": outline["title"], "body": "", "notes": "", "visual": outline["visual"]}]
    for s in slides:
        s["body"] = finish_sentence(s["body"])
    emit("outline", "done")

    todo = [s for s in slides if s["visual"] in TYPE_IDS]
    single = req.format == "infographic"  # one diagram for the whole text
    emit("visuals", "running", detail=f"0 of {len(todo)}")
    for n, s in enumerate(todo, start=1):
        emit("visuals", "running", detail=f"Designing diagram {n} of {len(todo)}")
        try:
            if single:
                s["visual"] = build_visual(s["visual"], f"{s['headline']}. Cover the whole content, not one part of it.", facts, voice)
            else:
                avoid = [o["headline"] for o in slides if o is not s and o["role"] not in ("title", "summary", "cta")]
                s["visual"] = build_visual(s["visual"], f"{s['headline']}. {s['body']}", facts, voice, avoid)
        except HTTPException:
            raise  # a guardrail stopped the run (budget, deadline, policy, kill switch)
        except Exception:
            s["visual"] = None  # the slide keeps its text; the editor can visualize it later
    for s in slides:
        if not isinstance(s["visual"], dict):
            s["visual"] = None
    emit("visuals", "done")

    emit("review", "running")
    result = clean(
        {
            "format": req.format,
            "title": outline["title"],
            "slides": slides,
            "caption": outline["caption"],
            "hashtags": [tag for h in outline["hashtags"] if (tag := re.sub(r"[^\w]", "", h))],
        }
    )
    result["sources"] = [{"title": s["title"], "url": s["url"], "date": s.get("date", "")} for s in sources]
    review_copy(
        [f"{s['headline']} {s['body']} {s.get('notes', '')}" for s in result["slides"]] + [result["caption"]],
        evidence=f"{brief}\n{facts}",
        sources=[s.get("snippet", "") for s in sources],
        examples=[],
    )
    emit("review", "done")
    return result


@router.post("/generate")
def generate(req: GenerateRequest, user: dict = Depends(current_user)):
    req = _validated(req)
    if not (req.topic or req.text.strip() or (req.idea and req.idea.title)):
        raise GuardrailViolation(422, "Add a topic or paste some text first.", "empty")
    admission = admit(user["id"], "design", "visuals.generate")

    def job(emit, _cancelled: threading.Event) -> dict:
        return _generate(req, user["id"], emit)

    return stream_job(job, admission)


class VisualizeRequest(BaseModel):
    text: Annotated[str, StringConstraints(min_length=3, max_length=3000)]
    type: Literal[TYPE_IDS] | None = None  # type: ignore[valid-type]  # keep this type (regenerate); otherwise pick one
    facts: Annotated[str, StringConstraints(max_length=6000)] = ""


@router.post("/visualize")
def visualize(req: VisualizeRequest, user: dict = Depends(current_user)):
    with assist(user["id"], "visuals.visualize"):
        text = check_data(req.text, "the text")
        if len(text.strip()) < 3:
            raise GuardrailViolation(422, "Add a little more text to visualize.", "empty")
        screen(text, "text")
        voice = _voice(user["id"])
        facts = f"{text}\n{check_data(req.facts, 'the facts')}"
        vtype = req.type or pick_type(text, voice)
        return {"visual": build_visual(vtype, text, facts, voice)}
