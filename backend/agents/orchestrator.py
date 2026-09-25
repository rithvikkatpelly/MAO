"""LangGraph orchestration for the Agentic AI Content Studio pipeline.

Graph shape (mirrors the architecture diagram):

    START -> research -> await_idea_selection (human-in-the-loop)
          -> [deep_research, brand_context]   (parallel)
          -> content -> design -> END

Run it directly with `uv run python -m agents.orchestrator`.
"""

import json
import sqlite3
from pathlib import Path
from typing import Annotated, TypedDict

from langchain_core.messages import HumanMessage
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import create_react_agent
from langgraph.types import Command, interrupt
from pydantic import BaseModel, Field

from agents.brand_tools import BRAND_TOOLS
from agents.content_tools import CarouselContent, generate_carousel_content, validate_and_refine
from agents.deep_research_tools import DEEP_RESEARCH_TOOLS
from agents.design_tools import render_html, select_design
from agents.research_tools import RESEARCH_TOOLS
from llm import get_llm
from platform_specs import get_platform_spec


# ---- shared state -----------------------------------------------------


def _keep_last(_current: object, new: object) -> object:
    return new


class Idea(BaseModel):
    title: str = Field(description="a short, punchy content idea title")
    angle: str = Field(description="the specific angle or hook for this idea")
    reason: str = Field(description="why this idea is worth posting right now")
    source: str = Field(default="", description="a URL or source that supports this idea, if any")


class IdeaList(BaseModel):
    ideas: list[Idea]


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
    """Research Agent: search the web/news for the topic, propose 3-5 ideas."""
    agent = create_react_agent(
        get_llm(temperature=0.5),
        tools=RESEARCH_TOOLS,
        prompt=(
            "You are a content research agent. Use the search tools (at most 3 calls total) "
            "to find current, concrete angles for the user's topic. When you have enough, "
            "reply with a short plain-text summary of 3 to 5 distinct content ideas — no JSON."
        ),
    )
    result = agent.invoke({"messages": [HumanMessage(content=state["user_request"])]})
    synthesis = result["messages"][-1].content

    idea_list = get_llm(temperature=0.3).with_structured_output(IdeaList).invoke(
        f"Convert this research synthesis into 3-5 structured content ideas for "
        f"{state['platform']}.\n\n{synthesis}"
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
    """Deep Research Agent: gather detailed facts about the selected idea."""
    idea = state["selected_idea"]
    agent = create_react_agent(
        get_llm(temperature=0.3),
        tools=DEEP_RESEARCH_TOOLS,
        prompt=(
            "You are a deep research agent. Use the tools (at most 3 calls total) to gather "
            "specific, citable facts about the given idea. Finish with a short brief: facts "
            "as bullet points, each with a source if you have one."
        ),
    )
    result = agent.invoke(
        {"messages": [HumanMessage(content=f"Idea: {idea['title']} — {idea['angle']}")]}
    )
    return {"research_context": result["messages"][-1].content}


def brand_context_node(state: AureaState) -> dict:
    """Brand/Context Agent: pull tone, audience, and platform guidelines."""
    agent = create_react_agent(
        get_llm(temperature=0),
        tools=BRAND_TOOLS,
        prompt=(
            "You are a brand context agent. Call get_user_preferences, "
            "get_platform_guidelines, and search_brand_knowledge to gather everything "
            "needed to write on-brand content for the given platform. Finish with a short "
            "brief covering tone, audience, and platform formatting rules."
        ),
    )
    result = agent.invoke(
        {"messages": [HumanMessage(content=f"Target platform: {state['platform']}")]}
    )

    tool_findings = {
        msg.name: msg.content for msg in result["messages"] if msg.type == "tool"
    }
    return {
        "brand_context": {
            "summary": result["messages"][-1].content,
            **tool_findings,
        }
    }


def content_node(state: AureaState) -> dict:
    """Content Agent: generate structured, platform-shaped content, then validate/refine it."""
    idea = state["selected_idea"]
    spec = get_platform_spec(state["platform"])
    brand_notes = (
        f"Format requirements: exactly {spec['slide_count']} slide(s), "
        f"format={spec['format']}, size={spec['width']}x{spec['height']}px.\n\n"
        f"{json.dumps(state['brand_context'], indent=2)}"
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
        {"carousel": draft, "brand_notes": brand_notes, "slide_count": spec["slide_count"]}
    )
    final = review.revised if (not review.is_valid and review.revised) else draft

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
