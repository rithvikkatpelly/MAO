"""Tools for the Research Agent: discover trending topics and content ideas."""

from langchain_core.tools import tool

from agents._web import top_sources


@tool
def search_sources(query: str) -> list[dict]:
    """Search the web and news for a topic and return the top 5 sources.

    Args:
        query: The topic to research.

    Returns up to 5 sources, each with title, url, date, and snippet.
    """
    return top_sources(query)


RESEARCH_TOOLS = [search_sources]
