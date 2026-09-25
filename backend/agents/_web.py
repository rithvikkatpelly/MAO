"""Shared web-access helpers used by both research_tools and deep_research_tools.

Not an agent's tool file itself — just the plain functions those two tool
files wrap with @tool so the actual HTTP/search logic isn't duplicated.
"""

import requests
from bs4 import BeautifulSoup
from ddgs import DDGS


def web_search(query: str, max_results: int = 5) -> list[dict]:
    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=max_results))
    return [
        {"title": r.get("title", ""), "url": r.get("href", ""), "snippet": r.get("body", "")}
        for r in results
    ]


def news_search(query: str, max_results: int = 5) -> list[dict]:
    with DDGS() as ddgs:
        results = list(ddgs.news(query, max_results=max_results))
    return [
        {
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "date": r.get("date", ""),
            "snippet": r.get("body", ""),
        }
        for r in results
    ]


def read_url(url: str, max_chars: int = 3000) -> str:
    response = requests.get(
        url, timeout=10, headers={"User-Agent": "Mozilla/5.0 (AureaStudio research bot)"}
    )
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    text = " ".join(soup.get_text(separator=" ").split())
    return text[:max_chars]
