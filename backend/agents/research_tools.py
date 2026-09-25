"""Tools for the Research Agent: discover trending topics and content ideas."""

from langchain_core.tools import tool

from agents._web import news_search, read_url, web_search


@tool
def search_web(query: str) -> list[dict]:
    """Search the web for up-to-date information on a topic.

    Args:
        query: The search query.

    Returns a list of results, each with title, url, and snippet.
    """
    return web_search(query)


@tool
def search_news(query: str) -> list[dict]:
    """Search recent news articles for a topic.

    Args:
        query: The search query.

    Returns a list of articles, each with title, url, date, and snippet.
    """
    return news_search(query)


@tool
def read_url_content(url: str) -> str:
    """Fetch a web page and return its readable text content.

    Args:
        url: The URL to fetch.
    """
    return read_url(url)


@tool
def search_trends(topic: str) -> list[dict]:
    """Search for what's currently trending around a topic, to spot fresh angles.

    Args:
        topic: The topic to find trending angles for.
    """
    return web_search(f"{topic} trending 2026")


RESEARCH_TOOLS = [search_web, search_news, read_url_content, search_trends]
