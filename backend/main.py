import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from langgraph.types import Command
from pydantic import BaseModel

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
    source: str = ""


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
    visual_note: str


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


@app.post("/api/carousel/start", response_model=StartCarouselResponse)
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
    result = aurea_graph.invoke(initial_state, config=_config(thread_id))

    interrupts = result.get("__interrupt__")
    if not interrupts:
        raise HTTPException(500, "research step did not pause for idea selection as expected")

    return StartCarouselResponse(
        thread_id=thread_id, platform=req.platform.lower(), ideas=interrupts[0].value["ideas"]
    )


@app.post("/api/carousel/select", response_model=SelectIdeaResponse)
def select_idea(req: SelectIdeaRequest):
    config = _config(req.thread_id)
    state = aurea_graph.get_state(config)
    if not state.values:
        raise HTTPException(404, "unknown thread_id — start a new carousel")

    result = aurea_graph.invoke(Command(resume=req.idea_index), config=config)
    if result.get("errors"):
        raise HTTPException(400, "; ".join(result["errors"]))

    carousel = result["carousel"]
    return SelectIdeaResponse(
        thread_id=req.thread_id,
        platform=result["platform"],
        template=result["template"],
        slides=carousel["slides"],
        caption=carousel["caption"],
        hashtags=carousel["hashtags"],
        cta=carousel["cta"],
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
