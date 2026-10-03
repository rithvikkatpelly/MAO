import json
import queue
import threading
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from langgraph.types import Command
from typing import Literal

from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

import settings  # loads backend/.env before anything reads the environment
from agents.orchestrator import AureaState, aurea_graph
from api import ai, auth, instagram, items, profile, projects, trends
from api.auth import current_user
from api.items import log_pick, log_research
from db import close_db, db_status, init_db
from runtime import pipeline_lock
from llm import MODEL_NAME, get_llm
from platform_specs import PLATFORM_SPECS, get_platform_spec
from render.pdf_renderer import render_slides_to_pdf


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    if settings.DATABASE_URL:
        trends.start_scheduler()
    yield
    trends.stop_scheduler()
    close_db()


app = FastAPI(title="Aurea Studio API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(projects.router)
app.include_router(items.router)
app.include_router(ai.router)
app.include_router(trends.router)
app.include_router(instagram.router)

llm = get_llm()


class ChatRequest(BaseModel):
    prompt: str


class ChatResponse(BaseModel):
    model: str
    response: str


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "database": db_status()}


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, _user: dict = Depends(current_user)):
    result = await llm.ainvoke(req.prompt)
    return ChatResponse(model=MODEL_NAME, response=result.content)


# ---- carousel pipeline ----------------------------------------------------


Kind = Literal["carousel", "poster", "image", "thumbnail"]


class StartCarouselRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=500)
    platform: str
    kind: Kind | None = None
    slide_count: int | None = Field(default=None, ge=3, le=10)  # carousels only


class IdeaOut(BaseModel):
    title: str
    angle: str
    reason: str


class StartCarouselResponse(BaseModel):
    thread_id: str
    platform: str
    ideas: list[IdeaOut]


class SelectIdeaRequest(BaseModel):
    thread_id: str
    idea_index: int


class SlideOut(BaseModel):
    index: int
    headline: str
    body: str


class SourceOut(BaseModel):
    title: str
    url: str
    date: str = ""


class SelectIdeaResponse(BaseModel):
    thread_id: str
    platform: str
    template: str
    slides: list[SlideOut]
    caption: str
    hashtags: list[str]
    cta: str
    sources: list[SourceOut] = []


def _config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


def _owned_state(thread_id: str, user: dict) -> dict:
    """A pipeline thread's saved state, only if it belongs to this user."""
    saved = aurea_graph.get_state(_config(thread_id)).values
    if not saved or saved.get("owner_id") != str(user["id"]):
        raise HTTPException(404, "Unknown session. Start a new post.")
    return saved


@app.get("/api/platforms")
def list_platforms():
    return PLATFORM_SPECS


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


_pipeline_lock = pipeline_lock  # shared with trend watch runs (runtime.py)
_END = object()


def _pipeline_worker(graph_input, thread_id: str, out: queue.Queue, cancelled: threading.Event, build_result):
    """Runs the graph on its own thread, pushing events onto `out`. Owns the pipeline lock."""
    try:
        stream = aurea_graph.stream(graph_input, config=_config(thread_id), stream_mode="tasks")
        try:
            for event in stream:
                if "result" in event:
                    if event["error"]:
                        raise RuntimeError(f"{event['name']} failed: {event['error']}")
                    out.put({"type": "step", "node": event["name"], "status": "done"})
                else:
                    out.put({"type": "step", "node": event["name"], "status": "running"})
                if cancelled.is_set():  # client went away: stop before the next step burns GPU time
                    return
        finally:
            stream.close()

        state = aurea_graph.get_state(_config(thread_id)).values
        if state.get("errors"):
            raise RuntimeError("; ".join(state["errors"]))
        out.put({"type": "result", "data": build_result(state)})
    except Exception as exc:
        out.put({"type": "error", "message": str(exc)})
    finally:
        out.put(_END)
        _pipeline_lock.release()


async def _stream_pipeline(graph_input, thread_id: str, build_result) -> AsyncIterator[str]:
    """SSE events: a 'step' per node start/finish (names are LangGraph node names),
    then one 'result' or 'error'."""
    if not _pipeline_lock.acquire(blocking=False):
        yield _sse({"type": "error", "message": "Another generation is already running. Wait for it to finish, then try again."})
        return

    out: queue.Queue = queue.Queue()
    cancelled = threading.Event()
    try:
        threading.Thread(
            target=_pipeline_worker, args=(graph_input, thread_id, out, cancelled, build_result), daemon=True
        ).start()
    except Exception:
        _pipeline_lock.release()
        raise

    try:
        while True:
            item = await run_in_threadpool(out.get)
            if item is _END:
                break
            yield _sse(item)
    finally:
        cancelled.set()


_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def _initial_state(topic: str, platform: str, kind, slide_count, user: dict) -> AureaState:
    if platform.lower() not in PLATFORM_SPECS:
        raise HTTPException(400, f"unknown platform: {platform}")
    return {
        "user_request": topic,
        "platform": platform.lower(),
        "content_type": "carousel",
        "ideas": [],
        "selected_idea": None,
        "research_context": "",
        "brand_context": {},
        "carousel": None,
        "template": "",
        "slides_html": [],
        "errors": [],
        "owner_id": str(user["id"]),
        "brand_profile": profile.brand_profile_for(user["id"]),
        "kind": kind,
        "slide_count": slide_count,
        "sources": [],
    }


@app.post("/api/carousel/start")
def start_carousel(req: StartCarouselRequest, user: dict = Depends(current_user)):
    initial_state = _initial_state(req.topic, req.platform, req.kind, req.slide_count, user)
    thread_id = str(uuid.uuid4())

    def build_result(state: dict) -> dict:
        log_research(user["id"], thread_id, topic=req.topic, platform=state["platform"], kind=req.kind or "", origin="research", ideas=state["ideas"])
        return StartCarouselResponse(
            thread_id=thread_id, platform=state["platform"], ideas=state["ideas"]
        ).model_dump()

    return StreamingResponse(
        _stream_pipeline(initial_state, thread_id, build_result),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


class FromIdeaRequest(BaseModel):
    idea: IdeaOut
    topic: str = Field(default="", max_length=500)
    platform: str
    kind: Kind | None = None
    slide_count: int | None = Field(default=None, ge=3, le=10)


@app.post("/api/carousel/from-idea", response_model=StartCarouselResponse)
def start_from_idea(req: FromIdeaRequest, user: dict = Depends(current_user)):
    """Skip research for an idea the creator already has (backlog, series, week plan).

    Records the idea as the research result and runs to the human-in-the-loop pause
    (no model calls), so the client continues with /select and idea_index 0.
    """
    state = _initial_state(req.topic or req.idea.title, req.platform, req.kind, req.slide_count, user)
    state["ideas"] = [req.idea.model_dump()]
    thread_id = str(uuid.uuid4())
    aurea_graph.update_state(_config(thread_id), state, as_node="research")
    aurea_graph.invoke(None, config=_config(thread_id))
    log_research(user["id"], thread_id, topic=state["user_request"], platform=state["platform"], kind=req.kind or "", origin="idea", ideas=state["ideas"])
    return StartCarouselResponse(thread_id=thread_id, platform=state["platform"], ideas=state["ideas"])


@app.post("/api/carousel/select")
def select_idea(req: SelectIdeaRequest, user: dict = Depends(current_user)):
    saved = _owned_state(req.thread_id, user)
    if not 0 <= req.idea_index < len(saved["ideas"]):
        raise HTTPException(400, f"invalid idea_index: {req.idea_index}")

    def build_result(state: dict) -> dict:
        carousel = state["carousel"]
        log_pick(user["id"], req.thread_id, (state.get("selected_idea") or {}).get("title", ""), state.get("sources") or [])
        return SelectIdeaResponse(
            thread_id=req.thread_id,
            platform=state["platform"],
            template=state["template"],
            slides=carousel["slides"],
            caption=carousel["caption"],
            hashtags=carousel["hashtags"],
            cta=carousel["cta"],
            sources=state.get("sources") or [],
        ).model_dump()

    return StreamingResponse(
        _stream_pipeline(Command(resume=req.idea_index), req.thread_id, build_result),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@app.get("/api/carousel/{thread_id}/pdf")
def download_carousel_pdf(thread_id: str, user: dict = Depends(current_user)):
    state = _owned_state(thread_id, user)
    if not state.get("slides_html"):
        raise HTTPException(404, "no rendered carousel for this thread_id yet")

    spec = get_platform_spec(state["platform"])
    pdf_bytes = render_slides_to_pdf(state["slides_html"], spec["width"], spec["height"])

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="carousel-{thread_id[:8]}.pdf"'},
    )
