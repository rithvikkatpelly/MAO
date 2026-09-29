"""Shared web-search helpers used by both research_tools and deep_research_tools.

Not an agent's tool file itself — just the plain functions those two tool
files wrap with @tool so the search logic isn't duplicated.
"""

from itertools import zip_longest

from ddgs import DDGS

MAX_SOURCES = 5


def _web(query: str, n: int) -> list[dict]:
    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=n))
    return [
        {"title": r.get("title", ""), "url": r.get("href", ""), "date": "", "snippet": r.get("body", "")}
        for r in results
    ]


def _news(query: str, n: int) -> list[dict]:
    with DDGS() as ddgs:
        results = list(ddgs.news(query, max_results=n))
    return [
        {"title": r.get("title", ""), "url": r.get("url", ""), "date": r.get("date", ""), "snippet": r.get("body", "")}
        for r in results
    ]


def top_sources(query: str, n: int = MAX_SOURCES) -> list[dict]:
    """The top n unique sources for a query, alternating fresh news and web results."""
    batches = []
    for search in (_news, _web):
        try:
            batches.append(search(query, n))
        except Exception:
            batches.append([])  # ddgs raises when a search has zero results

    merged, seen = [], set()
    for pair in zip_longest(*batches):
        for item in pair:
            if item and item["url"] not in seen:
                seen.add(item["url"])
                merged.append(item)

    if not merged:
        raise RuntimeError(f"web search returned no sources for: {query!r}")
    return merged[:n]


def format_sources(sources: list[dict]) -> str:
    lines = []
    for i, s in enumerate(sources, start=1):
        date = f" ({s['date'][:10]})" if s["date"] else ""
        lines.append(f"[{i}] {s['title']}{date}: {s['snippet'][:300]} <{s['url']}>")
    return "\n".join(lines)
