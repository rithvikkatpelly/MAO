"""Tools for the Deep Research Agent: gather detailed facts on the selected idea."""

from langchain_core.messages import SystemMessage
from langchain_core.tools import tool

from agents._web import news_search, read_url, web_search
from llm import get_llm


@tool
def search_web(query: str) -> list[dict]:
    """Search the web for detailed information on a topic.

    Args:
        query: The search query.

    Returns a list of results, each with title, url, and snippet.
    """
    return web_search(query)


@tool
def search_news(query: str) -> list[dict]:
    """Search recent news articles for the latest information on a topic.

    Args:
        query: The search query.

    Returns a list of articles, each with title, url, date, and snippet.
    """
    return news_search(query)


@tool
def read_url_content(url: str) -> str:
    """Fetch a web page and return its readable text content, to read a source in full.

    Args:
        url: The URL to fetch.
    """
    return read_url(url)


@tool
def extract_key_facts(text: str) -> list[str]:
    """Summarize a block of research text into a short list of key, citable facts.

    Args:
        text: The raw text to summarize (e.g. a search snippet or page content).
    """
    llm = get_llm(temperature=0)
    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    "Extract the key factual points from the given text as a short "
                    "bullet list. Reply with one fact per line, no numbering, no preamble."
                )
            ),
            {"role": "user", "content": text},
        ]
    )
    lines = [line.strip("-• ").strip() for line in response.content.splitlines()]
    return [line for line in lines if line]


DEEP_RESEARCH_TOOLS = [search_web, search_news, read_url_content, extract_key_facts]
