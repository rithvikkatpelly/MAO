"""Tools for the Brand/Context Agent: brand guidelines, audience, and platform rules.

There's no real vector DB or user-settings store yet, so these read from a
small static profile below. Swap _BRAND_KNOWLEDGE / _USER_PREFERENCES /
_PREVIOUS_CONTENT for a real RAG index and user-settings table later —
the tool signatures won't need to change.
"""

from langchain_core.tools import tool

_BRAND_KNOWLEDGE = [
    "Aurea Studio's voice is confident and clear, never hypey or full of jargon.",
    "We write for builders: founders, engineers, and product people, not general consumers.",
    "Every carousel should open with a concrete hook, not a vague question.",
    "Avoid emoji in headlines. One emoji at most per slide, only if it adds meaning.",
    "Always end a carousel with a clear, specific call to action, not 'thoughts?'.",
]

_USER_PREFERENCES = {
    "tone": "confident, plain-spoken, a little opinionated",
    "audience": "startup founders, engineers, and product managers interested in AI tooling",
    "goals": "drive signups for Aurea Studio and build credibility as an AI/agents voice",
    "avoid": ["corporate buzzwords", "excessive emoji", "clickbait titles"],
}

_PREVIOUS_CONTENT = [
    {"platform": "LinkedIn", "title": "Why most 'AI agents' are just a for-loop with extra steps"},
    {"platform": "LinkedIn", "title": "We shipped a multi-agent pipeline in a weekend. Here's the stack."},
    {"platform": "X", "title": "Human-in-the-loop isn't a compromise. It's the feature."},
]

_PLATFORM_GUIDELINES = {
    "linkedin": {
        "slide_count": "6-10",
        "tone": "professional but personable, first person",
        "char_limit_per_slide": 280,
        "hashtags": "3-5 at the end of the caption, not on slides",
    },
    "instagram": {
        "slide_count": "5-8",
        "tone": "visual-first, short punchy lines",
        "char_limit_per_slide": 150,
        "hashtags": "5-10 in the caption",
    },
    "x": {
        "slide_count": "4-6",
        "tone": "terse, direct, one idea per slide",
        "char_limit_per_slide": 200,
        "hashtags": "0-2, rarely used",
    },
    "threads": {
        "slide_count": "4-6",
        "tone": "conversational, informal",
        "char_limit_per_slide": 220,
        "hashtags": "0-2",
    },
}


@tool
def search_brand_knowledge(query: str) -> list[str]:
    """Search brand guidelines for notes relevant to a query.

    Args:
        query: Keywords describing what kind of guidance to look for
            (e.g. "tone", "emoji", "call to action").
    """
    terms = query.lower().split()
    matches = [note for note in _BRAND_KNOWLEDGE if any(t in note.lower() for t in terms)]
    return matches or _BRAND_KNOWLEDGE


@tool
def get_user_preferences() -> dict:
    """Get the user's stored tone, audience, and content goals."""
    return _USER_PREFERENCES


@tool
def get_previous_content(platform: str | None = None) -> list[dict]:
    """Get titles of past successful posts, optionally filtered by platform.

    Args:
        platform: Optional platform name to filter by (e.g. "LinkedIn", "X").
    """
    if not platform:
        return _PREVIOUS_CONTENT
    return [p for p in _PREVIOUS_CONTENT if p["platform"].lower() == platform.lower()]


@tool
def get_platform_guidelines(platform: str) -> dict:
    """Get formatting and tone guidelines for a specific platform.

    Args:
        platform: The target platform (e.g. "LinkedIn", "Instagram", "X", "Threads").
    """
    return _PLATFORM_GUIDELINES.get(
        platform.lower(),
        {"slide_count": "5-8", "tone": "clear and direct", "char_limit_per_slide": 200, "hashtags": "0-3"},
    )


BRAND_TOOLS = [search_brand_knowledge, get_user_preferences, get_previous_content, get_platform_guidelines]
