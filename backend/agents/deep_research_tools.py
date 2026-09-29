"""Tools for the Deep Research Agent: gather detailed facts on the selected idea."""

from langchain_core.tools import tool

from agents._web import top_sources
from llm import get_llm


@tool
def search_sources(query: str) -> list[dict]:
    """Search the web and news for a topic and return the top 5 sources.

    Args:
        query: The idea/topic to find supporting sources for.

    Returns up to 5 sources, each with title, url, date, and snippet.
    """
    return top_sources(query)


@tool
def extract_key_facts(idea: str, sources_text: str) -> str:
    """Distill numbered sources into a short brief of key, citable facts.

    Args:
        idea: The content idea the facts should support.
        sources_text: The numbered sources (title, snippet, url) to draw from.
    """
    prompt = (
        f"Content idea: {idea}\n\nSources:\n{sources_text}\n\n"
        "Write at most 5 bullet points of specific, useful facts from these sources. "
        "Each bullet: one sentence under 25 words, ending with its source number like [2]. "
        "Use only what the sources say."
    )
    return get_llm(temperature=0.2, max_tokens=350).invoke(prompt).content


DEEP_RESEARCH_TOOLS = [search_sources, extract_key_facts]
