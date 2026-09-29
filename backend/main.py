import json
import queue
import threading
import uuid
from collections.abc import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from langgraph.types import Command
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from agents.orchestrator import AureaState, aurea_graph
from llm import MODEL_NAME, get_llm
from platform_specs import PLATFORM_SPECS, get_platform_spec
from render.pdf_renderer import render_slides_to_pdf

app = FastAPI(title="Aurea Studio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

llm = get_llm()


class ChatRequest(BaseModel):
    prompt: str


class ChatResponse(BaseModel):
    model: str
    response: str


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    result = await llm.ainvoke(req.prompt)
    return ChatResponse(model=MODEL_NAME, response=result.content)


# ---- carousel pipeline ----------------------------------------------------


class StartCarouselRequest(BaseModel):
    topic: str
    platform: str


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


class SelectIdeaResponse(BaseModel):
    thread_id: str
    platform: str
    template: str
    slides: list[SlideOut]
    caption: str
    hashtags: list[str]
    cta: str


def _config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


@app.get("/api/platforms")
def list_platforms():
    return PLATFORM_SPECS


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


# One pipeline at a time: the local model serves a single request stream, so two
# concurrent runs just make both take roughly twice as long.
_pipeline_lock = threading.Lock()
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


@app.post("/api/carousel/start")
def start_carousel(req: StartCarouselRequest):
    if req.platform.lower() not in PLATFORM_SPECS:
        raise HTTPException(400, f"unknown platform: {req.platform}")

    thread_id = str(uuid.uuid4())
    initial_state: AureaState = {
        "user_request": req.topic,
        "platform": req.platform.lower(),
        "content_type": "carousel",
        "ideas": [],
        "selected_idea": None,
        "research_context": "",
        "brand_context": {},
        "carousel": None,
        "template": "",
        "slides_html": [],
        "errors": [],
    }
    def build_result(state: dict) -> dict:
        return StartCarouselResponse(
            thread_id=thread_id, platform=state["platform"], ideas=state["ideas"]
        ).model_dump()

    return StreamingResponse(
        _stream_pipeline(initial_state, thread_id, build_result),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@app.post("/api/carousel/select")
def select_idea(req: SelectIdeaRequest):
    saved = aurea_graph.get_state(_config(req.thread_id)).values
    if not saved:
        raise HTTPException(404, "unknown thread_id — start a new carousel")
    if not 0 <= req.idea_index < len(saved["ideas"]):
        raise HTTPException(400, f"invalid idea_index: {req.idea_index}")

    def build_result(state: dict) -> dict:
        carousel = state["carousel"]
        return SelectIdeaResponse(
            thread_id=req.thread_id,
            platform=state["platform"],
            template=state["template"],
            slides=carousel["slides"],
            caption=carousel["caption"],
            hashtags=carousel["hashtags"],
            cta=carousel["cta"],
        ).model_dump()

    return StreamingResponse(
        _stream_pipeline(Command(resume=req.idea_index), req.thread_id, build_result),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@app.get("/api/carousel/{thread_id}/pdf")
def download_carousel_pdf(thread_id: str):
    state = aurea_graph.get_state(_config(thread_id)).values
    if not state or not state.get("slides_html"):
        raise HTTPException(404, "no rendered carousel for this thread_id yet")

    spec = get_platform_spec(state["platform"])
    pdf_bytes = render_slides_to_pdf(state["slides_html"], spec["width"], spec["height"])

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="carousel-{thread_id[:8]}.pdf"'},
    )
