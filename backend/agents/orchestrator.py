"""LangGraph orchestration for the Agentic AI Content Studio pipeline.

Graph shape (mirrors the architecture diagram):

    START -> research -> await_idea_selection (human-in-the-loop)
          -> [deep_research, brand_context]   (parallel)
          -> content -> design -> END

Every node calls its tools directly and makes at most one or two LLM calls.
(An LLM-driven tool loop costs extra round trips on a local 8B model and made run
time swing from 1 to 3+ minutes per agent.)

Run it directly with `uv run python -m agents.orchestrator`.
"""

import json
import sqlite3
from pathlib import Path
from typing import Annotated, TypedDict

from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt
from pydantic import BaseModel, Field

from agents._web import format_sources
from agents.brand_tools import (
    get_platform_guidelines,
    get_previous_content,
    get_user_preferences,
    search_brand_knowledge,
)
from agents.content_tools import CarouselContent, generate_carousel_content, validate_and_refine
from agents.deep_research_tools import extract_key_facts
from agents.deep_research_tools import search_sources as search_sources_deep
from agents.design_tools import render_html, select_design
from agents.research_tools import search_sources
from llm import invoke_structured
from platform_specs import get_platform_spec


# ---- shared state -----------------------------------------------------


def _keep_last(_current: object, new: object) -> object:
    return new


class Idea(BaseModel):
    title: str = Field(max_length=90, description="a punchy content idea title, under 10 words")
    angle: str = Field(max_length=180, description="the specific angle or hook, one sentence")
    reason: str = Field(max_length=150, description="why this is worth posting now, one short sentence")


class IdeaList(BaseModel):
    ideas: list[Idea] = Field(min_length=3, max_length=5)


class AureaState(TypedDict):
    user_request: str
    platform: str
    content_type: str
    ideas: Annotated[list[dict], _keep_last]
    selected_idea: Annotated[dict | None, _keep_last]
    research_context: Annotated[str, _keep_last]
    brand_context: Annotated[dict, _keep_last]
    carousel: Annotated[dict | None, _keep_last]
    template: Annotated[str, _keep_last]
    slides_html: Annotated[list[str], _keep_last]
    errors: Annotated[list[str], _keep_last]


# ---- agent nodes --------------------------------------------------------


def research_node(state: AureaState) -> dict:
    """Research Agent: search the top 5 sources, propose 3-5 ideas."""
    sources = search_sources.invoke({"query": state["user_request"]})

    idea_list = invoke_structured(
        IdeaList,
        f"Topic: {state['user_request']}\n\nTop sources:\n{format_sources(sources)}\n\n"
        f"Propose 3 to 5 distinct {state['platform']} content ideas grounded in these sources.",
        temperature=0.5,
        max_tokens=800,
    )
    return {"ideas": [idea.model_dump() for idea in idea_list.ideas]}


def await_idea_selection_node(state: AureaState) -> dict:
    """Human-in-the-loop gate: pause until the user picks one idea."""
    selected_index = interrupt({"ideas": state["ideas"]})
    ideas = state["ideas"]
    index = int(selected_index)
    if not 0 <= index < len(ideas):
        return {"errors": state.get("errors", []) + [f"invalid idea index: {selected_index}"]}
    return {"selected_idea": ideas[index]}


def deep_research_node(state: AureaState) -> dict:
    """Deep Research Agent: top 5 sources for the selected idea, distilled into key facts."""
    idea = state["selected_idea"]
    sources = search_sources_deep.invoke({"query": idea["title"]})
    facts = extract_key_facts.invoke(
        {"idea": f"{idea['title']} — {idea['angle']}", "sources_text": format_sources(sources)}
    )
    return {"research_context": facts}


def brand_context_node(state: AureaState) -> dict:
    """Brand/Context Agent: pull tone, audience, and platform guidelines."""
    platform = state["platform"]
    return {
        "brand_context": {
            "user_preferences": get_user_preferences.invoke({}),
            "platform_guidelines": get_platform_guidelines.invoke({"platform": platform}),
            "brand_knowledge": search_brand_knowledge.invoke({"query": "tone audience call to action"}),
            "previous_content": get_previous_content.invoke({"platform": platform}),
        }
    }


def content_node(state: AureaState) -> dict:
    """Content Agent: generate structured, platform-shaped content, then validate it."""
    idea = state["selected_idea"]
    spec = get_platform_spec(state["platform"])
    brand = state["brand_context"]
    brand_notes = (
        f"Format requirements: exactly {spec['slide_count']} slide(s), format={spec['format']}.\n\n"
        f"{json.dumps(brand, indent=2)}"
    )

    draft: CarouselContent = generate_carousel_content.invoke(
        {
            "idea": f"{idea['title']} — {idea['angle']}",
            "research_notes": state["research_context"],
            "brand_notes": brand_notes,
            "platform": state["platform"],
            "slide_count": spec["slide_count"],
            "format_hint": spec["format"],
        }
    )

    review = validate_and_refine.invoke(
        {
            "carousel": draft,
            "brand_notes": brand_notes,
            "slide_count": spec["slide_count"],
            "char_limit": brand["platform_guidelines"]["char_limit_per_slide"],
        }
    )
    final = review.revised if review.revised else draft

    return {"carousel": final.model_dump()}


def design_node(state: AureaState) -> dict:
    """Design Agent: pick a template, then render each slide to platform-sized HTML."""
    carousel = CarouselContent(**state["carousel"])
    platform = state["platform"]

    choice = select_design.invoke({"carousel": carousel, "platform": platform})
    html_pages = render_html.invoke(
        {"carousel": carousel, "platform": platform, "template": choice.template}
    )

    return {"template": choice.template, "slides_html": html_pages}


# ---- graph ---------------------------------------------------------------


def build_graph():
    graph = StateGraph(AureaState)
    graph.add_node("research", research_node)
    graph.add_node("await_idea_selection", await_idea_selection_node)
    graph.add_node("deep_research", deep_research_node)
    graph.add_node("brand_context", brand_context_node)
    graph.add_node("content", content_node)
    graph.add_node("design", design_node)

    graph.add_edge(START, "research")
    graph.add_edge("research", "await_idea_selection")
    graph.add_edge("await_idea_selection", "deep_research")
    graph.add_edge("await_idea_selection", "brand_context")
    graph.add_edge("deep_research", "content")
    graph.add_edge("brand_context", "content")
    graph.add_edge("content", "design")
    graph.add_edge("design", END)

    # SQLite (not in-memory) so sessions survive `--reload` restarts during dev.
    db_path = Path(__file__).resolve().parent.parent / "aurea_sessions.db"
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    checkpointer = SqliteSaver(conn)
    checkpointer.setup()

    return graph.compile(checkpointer=checkpointer)


aurea_graph = build_graph()


if __name__ == "__main__":
    config = {"configurable": {"thread_id": "demo-1"}}
    initial_state: AureaState = {
        "user_request": "Create a LinkedIn carousel about AI agents",
        "platform": "linkedin",
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

    print("--- running research agent ---")
    result = aurea_graph.invoke(initial_state, config=config)

    interrupt_payload = result["__interrupt__"][0].value
    ideas = interrupt_payload["ideas"]
    print(f"\n{len(ideas)} ideas ready for review:")
    for i, idea in enumerate(ideas):
        print(f"  [{i}] {idea['title']} — {idea['angle']}")

    chosen = 0
    print(f"\n--- resuming with idea [{chosen}] (auto-selected for this smoke test) ---")
    final_state = aurea_graph.invoke(Command(resume=chosen), config=config)

    print("\n--- final carousel ---")
    print(json.dumps(final_state["carousel"], indent=2))
    print(f"\n--- design: template={final_state['template']!r}, "
          f"{len(final_state['slides_html'])} slide(s) rendered ---")
    if final_state.get("errors"):
        print("\nerrors:", final_state["errors"])
