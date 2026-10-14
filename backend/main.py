import threading
import uuid
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from langgraph.types import Command
from pydantic import BaseModel, Field, StringConstraints

import settings  # loads backend/.env before anything reads the environment
from agents.orchestrator import AureaState, aurea_graph
from api import account, ai, assistant, auth, design, instagram, items, profile, projects, trends, visuals
from api.auth import current_user
from api.items import log_pick, log_research
from db import close_db, connection, db_status, init_db
from guardrails import conversation, flags, maintenance, ratelimit
from guardrails.errors import GuardrailViolation
from guardrails.http import BodySizeLimit, OriginGuard, SecurityHeaders
from guardrails.jobs import admit, assist, stream_job
from guardrails.semantic import screen
from guardrails.validators import check_instruction
from llm import MODEL_NAME
from platform_specs import PLATFORM_SPECS, get_platform_spec
from render.pdf_renderer import render_slides_to_pdf


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    if settings.DATABASE_URL:
        trends.start_scheduler()
        maintenance.start()
    yield
    maintenance.stop()
    trends.stop_scheduler()
    close_db()


# Interactive API docs only in development.
_docs = {} if not settings.COOKIE_SECURE else {"docs_url": None, "redoc_url": None, "openapi_url": None}
app = FastAPI(title="Aurea Studio API", lifespan=lifespan, **_docs)

# Added innermost first: requests pass BodySizeLimit, SecurityHeaders, OriginGuard, then CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
    expose_headers=["Content-Disposition"],  # so downloads keep their file names
)
app.add_middleware(OriginGuard, allowed_origins=settings.ALLOWED_ORIGINS)
app.add_middleware(SecurityHeaders, hsts=settings.COOKIE_SECURE)
app.add_middleware(BodySizeLimit)

app.include_router(auth.router)
app.include_router(account.router)
app.include_router(profile.router)
app.include_router(projects.router)
app.include_router(items.router)
app.include_router(ai.router)
app.include_router(assistant.router)
app.include_router(design.router)
app.include_router(trends.router)
app.include_router(instagram.router)
app.include_router(visuals.router)


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "database": db_status(), "ai": flags.enabled("ai")}


# ---- chat, with a bounded context window ------------------------------------------------

ConversationId = Annotated[str, StringConstraints(pattern=r"^[0-9a-f-]{36}$")]


class ChatRequest(BaseModel):
    message: Annotated[str, StringConstraints(max_length=conversation.MAX_MESSAGE_CHARS)] = ""
    prompt: Annotated[str, StringConstraints(max_length=conversation.MAX_MESSAGE_CHARS)] = ""  # older clients
    conversation_id: ConversationId | None = None


@app.post("/chat")
def chat(req: ChatRequest, user: dict = Depends(current_user)):
    with assist(user["id"], "chat", bucket="chat", max_calls=2):
        return conversation.chat_turn(user["id"], req.conversation_id, req.message or req.prompt)


@app.get("/api/chat/{conversation_id}")
def get_chat(conversation_id: ConversationId, user: dict = Depends(current_user)):
    return conversation.get_conversation(user["id"], conversation_id)


@app.delete("/api/chat/{conversation_id}")
def delete_chat(conversation_id: ConversationId, user: dict = Depends(current_user)):
    conversation.delete_conversation(user["id"], conversation_id)
    return {"ok": True}


# ---- carousel pipeline ----------------------------------------------------

Kind = Literal["carousel", "poster", "image", "thumbnail"]
ThreadId = Annotated[str, StringConstraints(pattern=r"^[0-9a-f-]{36}$")]


class StartCarouselRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=500)
    platform: str = Field(max_length=20)
    kind: Kind | None = None
    slide_count: int | None = Field(default=None, ge=3, le=10)  # carousels only


class IdeaOut(BaseModel):
    title: str = Field(max_length=120)
    angle: str = Field(default="", max_length=600)
    reason: str = Field(default="", max_length=600)


class StartCarouselResponse(BaseModel):
    thread_id: str
    platform: str
    ideas: list[IdeaOut]
    warnings: list[str] = []


class SelectIdeaRequest(BaseModel):
    thread_id: ThreadId
    idea_index: int = Field(ge=0, le=9)


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


def _register_thread(thread_id: str, user: dict) -> None:
    """Remember the run so it can be purged on schedule and with the account."""
    with connection() as conn:
        conn.execute(
            "INSERT INTO pipeline_threads (thread_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (thread_id, user["id"])
        )


@app.get("/api/platforms")
def list_platforms():
    return PLATFORM_SPECS


def _graph_job(graph_input, thread_id: str, build_result, screen_text: str = "", what: str = "topic"):
    """A pipeline job for stream_job: a semantic safety check on what the creator asked for,
    then the graph, reporting each node as a step."""

    def job(emit, cancelled: threading.Event) -> dict:
        if screen_text:
            emit("safety", "running")
            screen(screen_text, what)  # before any web search or generation
            emit("safety", "done")
        stream = aurea_graph.stream(graph_input, config=_config(thread_id), stream_mode="tasks")
        try:
            for event in stream:
                if "result" in event:
                    emit(event["name"], "done")
                else:
                    emit(event["name"], "running")
                if cancelled.is_set():  # client went away: stop before the next step burns GPU time
                    break
        finally:
            stream.close()
        state = aurea_graph.get_state(_config(thread_id)).values
        if state.get("errors"):
            raise GuardrailViolation(422, "This run could not continue. Start a new post.", "pipeline")
        return build_result(state)

    return job


def _initial_state(topic: str, platform: str, kind, slide_count, user: dict) -> AureaState:
    if platform.lower() not in PLATFORM_SPECS:
        raise HTTPException(400, "Unknown platform.")
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
    topic = check_instruction(req.topic, "topic", max_chars=500)
    initial_state = _initial_state(topic, req.platform, req.kind, req.slide_count, user)
    admission = admit(user["id"], "research", "carousel.start")
    thread_id = str(uuid.uuid4())
    try:
        _register_thread(thread_id, user)
    except BaseException:
        admission.refund()
        admission.release()
        raise

    def build_result(state: dict) -> dict:
        log_research(user["id"], thread_id, topic=topic, platform=state["platform"], kind=req.kind or "", origin="research", ideas=state["ideas"])
        return StartCarouselResponse(thread_id=thread_id, platform=state["platform"], ideas=state["ideas"]).model_dump()

    return stream_job(_graph_job(initial_state, thread_id, build_result, screen_text=topic), admission)


class FromIdeaRequest(BaseModel):
    idea: IdeaOut
    topic: str = Field(default="", max_length=500)
    platform: str = Field(max_length=20)
    kind: Kind | None = None
    slide_count: int | None = Field(default=None, ge=3, le=10)


@app.post("/api/carousel/from-idea", response_model=StartCarouselResponse)
def start_from_idea(req: FromIdeaRequest, user: dict = Depends(current_user)):
    """Skip research for an idea the creator already has (backlog, series, week plan).

    Records the idea as the research result and runs to the human-in-the-loop pause
    (no model calls), so the client continues with /select and idea_index 0.
    """
    flags.require("ai")
    ratelimit.hit(user["id"], "research")
    idea = IdeaOut(
        title=check_instruction(req.idea.title, "idea"),
        angle=check_instruction(req.idea.angle, "idea"),
        reason=check_instruction(req.idea.reason, "idea"),
    )
    topic = check_instruction(req.topic, "topic")
    state = _initial_state(topic or idea.title, req.platform, req.kind, req.slide_count, user)
    state["ideas"] = [idea.model_dump()]
    thread_id = str(uuid.uuid4())
    _register_thread(thread_id, user)
    aurea_graph.update_state(_config(thread_id), state, as_node="research")
    aurea_graph.invoke(None, config=_config(thread_id))
    log_research(user["id"], thread_id, topic=state["user_request"], platform=state["platform"], kind=req.kind or "", origin="idea", ideas=state["ideas"])
    return StartCarouselResponse(thread_id=thread_id, platform=state["platform"], ideas=state["ideas"])


@app.post("/api/carousel/select")
def select_idea(req: SelectIdeaRequest, user: dict = Depends(current_user)):
    saved = _owned_state(req.thread_id, user)
    if not 0 <= req.idea_index < len(saved["ideas"]):
        raise HTTPException(400, "That idea is not part of this research run.")
    if saved.get("carousel"):
        raise HTTPException(409, "This research run already produced a design. Start a new post.")
    admission = admit(user["id"], "design", "carousel.select")  # one of the creator's daily designs

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

    idea = saved["ideas"][req.idea_index]
    screen_text = f"{saved.get('user_request', '')}\n{idea.get('title', '')}: {idea.get('angle', '')}"
    return stream_job(_graph_job(Command(resume=req.idea_index), req.thread_id, build_result, screen_text=screen_text, what="idea"), admission)


@app.get("/api/carousel/{thread_id}/pdf")
def download_carousel_pdf(thread_id: ThreadId, user: dict = Depends(current_user)):
    state = _owned_state(thread_id, user)
    if not state.get("slides_html"):
        raise HTTPException(404, "no rendered carousel for this thread_id yet")
    ratelimit.hit(user["id"], "upload")

    spec = get_platform_spec(state["platform"])
    pdf_bytes = render_slides_to_pdf(state["slides_html"], spec["width"], spec["height"])

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="carousel-{thread_id[:8]}.pdf"'},
    )
