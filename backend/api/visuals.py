"""Presentation decks and Napkin-style infographics.

POST /generate streams progress (SSE, same event shape as the carousel pipeline):
    research   sources for a topic, or the creator's pasted text as the only source
    outline    decks: the storyline, with a diagram type per slide
               infographics: one title and the one diagram type for the whole text (Napkin style)
    visuals    one call per diagram to fill its typed form
    review     drop numbers that are not in the sources, clean house style
POST /visualize turns any text into one diagram (the editor's "Visualize" and "Regenerate").
"""

import json
import queue
import re
import threading
from collections.abc import Callable, Iterator
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
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
from runtime import pipeline_lock
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


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _generate(req: GenerateRequest, user_id, emit: Callable[..., None]) -> dict:
    voice = _voice(user_id)
    brief = req.topic or (req.idea.title if req.idea else "") or req.text[:300]
    if req.idea and req.idea.title:
        brief = f"{req.idea.title}: {req.idea.angle}" + (f" (topic: {req.topic})" if req.topic else "")

    emit("research", "running")
    if req.text.strip():
        facts, sources = req.text.strip(), []
    else:
        if not brief.strip():
            raise ValueError("Add a topic or paste some text first.")
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
    emit("review", "done")
    return result


def _worker(req: GenerateRequest, user_id, out: queue.Queue, cancelled: threading.Event) -> None:
    def emit(node: str, status: str, detail: str = "") -> None:
        if cancelled.is_set():
            raise RuntimeError("cancelled")
        out.put({"type": "step", "node": node, "status": status, **({"detail": detail} if detail else {})})

    try:
        out.put({"type": "result", "data": _generate(req, user_id, emit)})
    except Exception as exc:
        if not cancelled.is_set():
            out.put({"type": "error", "message": str(exc) or "Generation failed."})
    finally:
        out.put(None)
        pipeline_lock.release()


def _stream(req: GenerateRequest, user_id) -> Iterator[str]:
    if not pipeline_lock.acquire(blocking=False):
        yield _sse({"type": "error", "message": "Another generation is already running. Wait for it to finish, then try again."})
        return
    out: queue.Queue = queue.Queue()
    cancelled = threading.Event()
    try:
        threading.Thread(target=_worker, args=(req, user_id, out, cancelled), daemon=True).start()
    except Exception:
        pipeline_lock.release()
        raise
    try:
        while (item := out.get()) is not None:
            yield _sse(item)
    finally:
        cancelled.set()  # client went away: the worker stops at its next step


@router.post("/generate")
def generate(req: GenerateRequest, user: dict = Depends(current_user)):
    return StreamingResponse(
        _stream(req, user["id"]),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class VisualizeRequest(BaseModel):
    text: Annotated[str, StringConstraints(min_length=3, max_length=3000)]
    type: Literal[TYPE_IDS] | None = None  # type: ignore[valid-type]  # keep this type (regenerate); otherwise pick one
    facts: Annotated[str, StringConstraints(max_length=6000)] = ""


@router.post("/visualize")
def visualize(req: VisualizeRequest, user: dict = Depends(current_user)):
    voice = _voice(user["id"])
    facts = f"{req.text}\n{req.facts}"
    try:
        vtype = req.type or pick_type(req.text, voice)
        return {"visual": build_visual(vtype, req.text, facts, voice)}
    except Exception as exc:
        raise HTTPException(502, f"Could not build the visual: {exc}") from None
