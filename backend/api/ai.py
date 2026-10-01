"""Quick, single-call AI helpers used inside the editor and planner.

Every call includes the creator's voice (niche, tone, audience, words to avoid,
example posts) and every string in the result is cleaned of em dashes and emojis.
"""

from datetime import date, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, StringConstraints, create_model

from api.auth import current_user
from api.profile import brand_profile_for
from db import connection
from llm import invoke_structured
from text_rules import STYLE_RULE, clean

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _s(n: int):
    return Annotated[str, StringConstraints(max_length=n)]


# ---- shared context -------------------------------------------------------------


class SlideIn(BaseModel):
    kicker: _s(80) = ""
    headline: _s(300) = ""
    body: _s(1500) = ""


class SourceIn(BaseModel):
    title: _s(300) = ""
    url: _s(600) = ""


class ProjectIn(BaseModel):
    title: _s(200) = ""
    kind: _s(20) = "carousel"
    slides: list[SlideIn] = Field(default_factory=list, max_length=20)
    caption: _s(3000) = ""
    cta: _s(200) = ""
    sources: list[SourceIn] = Field(default_factory=list, max_length=10)
    idea: _s(600) = ""


def _voice(user_id) -> str:
    profile = brand_profile_for(user_id) or {}
    v = profile.get("voice", {})
    lines = [
        f"Creator: {v.get('brand_name', '')} ({v.get('role', '')}). Niche: {v.get('niche', '') or 'general'}.",
        f"Tone: {v.get('tone', '') or 'clear and friendly'}. Audience: {v.get('audience', '') or 'their followers'}.",
        f"Never use: {', '.join(profile.get('words_to_avoid', ['em dashes', 'emojis']))}.",
    ]
    examples = profile.get("example_posts", [])
    if examples:
        lines.append(
            "Style reference, an earlier post by the creator. Match its voice and rhythm, "
            "but never copy its sentences or claims:\n" + examples[0][:800]
        )
    return "\n".join(lines)


def _project_text(p: ProjectIn) -> str:
    parts = [f"Title: {p.title}"]
    if p.idea:
        parts.append(f"Idea: {p.idea}")
    for i, s in enumerate(p.slides, start=1):
        parts.append(f"Slide {i}: {s.kicker + ': ' if s.kicker else ''}{s.headline}. {s.body}".strip())
    if p.caption:
        parts.append(f"Caption: {p.caption}")
    if p.cta:
        parts.append(f"Call to action: {p.cta}")
    if p.sources:
        parts.append("Sources: " + "; ".join(s.title for s in p.sources if s.title))
    return "\n".join(parts)


def _run(schema, prompt: str, *, temperature: float = 0.5, max_tokens: int = 1200) -> dict:
    try:
        result = invoke_structured(schema, prompt + "\n\n" + STYLE_RULE, temperature=temperature, max_tokens=max_tokens)
    except Exception as exc:  # model offline, timeout, unparseable twice
        raise HTTPException(502, f"The AI engine could not finish: {exc}") from None
    return clean(result.model_dump())


# ---- per-slide actions ------------------------------------------------------------


class SlideCopy(BaseModel):
    headline: str = Field(max_length=90, description="the slide headline, under 10 words")
    body: str = Field(max_length=240, description="the slide body, one or two short sentences")


class HookOptions(BaseModel):
    hooks: list[Annotated[str, StringConstraints(max_length=90)]] = Field(min_length=3, max_length=3)


_ACTIONS = {
    "rewrite": "Rewrite this slide with fresh wording. Keep the same meaning and roughly the same length.",
    "shorten": "Shorten this slide. Cut the body to at most 15 words and the headline to at most 7 words. Keep the key point.",
    "punchier": "Make this slide punchier: stronger verbs, more specific, more confident. Keep it short.",
}


class SlideAction(BaseModel):
    action: Literal["rewrite", "shorten", "punchier", "hooks"]
    slide: SlideIn
    position: Literal["first", "middle", "last"] = "middle"
    project: ProjectIn


@router.post("/slide")
def slide_action(body: SlideAction, user: dict = Depends(current_user)):
    context = f"{_voice(user['id'])}\n\nThe whole post:\n{_project_text(body.project)}"
    current = f"Headline: {body.slide.headline}\nBody: {body.slide.body}"
    if body.action == "hooks":
        prompt = (
            f"{context}\n\nWrite 3 different scroll-stopping opening hooks (headlines) for this post. "
            "Use different techniques: a specific number, a bold contrarian claim, and a painful problem. "
            f"Each under 10 words.\n\nCurrent hook: {body.slide.headline}"
        )
        return _run(HookOptions, prompt, temperature=0.8, max_tokens=300)
    prompt = f"{context}\n\nThis is the {body.position} slide.\n{current}\n\n{_ACTIONS[body.action]}"
    return _run(SlideCopy, prompt, temperature=0.6, max_tokens=300)


# ---- repurpose into other formats -----------------------------------------------------


class XThread(BaseModel):
    posts: list[Annotated[str, StringConstraints(max_length=280)]] = Field(min_length=3, max_length=10, description="each post under 280 characters")


class LinkedInPost(BaseModel):
    text: str = Field(max_length=2600, description="the full post with short paragraphs and line breaks")


class InstagramCaption(BaseModel):
    caption: str = Field(max_length=1800)
    hashtags: list[Annotated[str, StringConstraints(max_length=30)]] = Field(min_length=5, max_length=12, description="without the # symbol")


class Newsletter(BaseModel):
    subject: str = Field(max_length=90)
    preview: str = Field(max_length=120, description="the preview text shown after the subject in inboxes")
    blurb: str = Field(max_length=1200)


class Beat(BaseModel):
    voiceover: str = Field(max_length=300, description="what the creator says")
    on_screen_text: str = Field(max_length=60, description="a 2 to 6 word caption summarizing the beat, never the full voiceover")


class VideoScript(BaseModel):
    title: str = Field(max_length=90)
    hook: str = Field(max_length=200, description="the first 3 seconds, spoken")
    hook_text: str = Field(max_length=60, description="2 to 6 words shown on screen during the hook")
    beats: list[Beat] = Field(min_length=3, max_length=7)
    cta: str = Field(max_length=150)


class YouTubePackage(BaseModel):
    titles: list[Annotated[str, StringConstraints(max_length=100)]] = Field(min_length=5, max_length=5)
    thumbnail_texts: list[Annotated[str, StringConstraints(max_length=40)]] = Field(min_length=3, max_length=3, description="2 to 5 words each")
    description: str = Field(max_length=1500)


FORMATS = {
    "x_thread": (XThread, "an X (Twitter) thread of 5 to 8 posts. Post 1 is the hook. Number nothing. Each post stands alone and is under 280 characters. The last post has the call to action."),
    "linkedin_post": (LinkedInPost, "a text-only LinkedIn post of 120 to 250 words. First line is a hook under 12 words, then short paragraphs of 1 to 2 lines, then a call to action. Up to 3 hashtags at the very end."),
    "instagram_caption": (InstagramCaption, "an Instagram caption: a hook first line, 60 to 150 words of value, a call to action, plus hashtags returned separately."),
    "newsletter": (Newsletter, "a newsletter section: a subject line, preview text, and a 100 to 180 word blurb that teases the idea and links to the full post."),
    "video_script": (VideoScript, "a 30 to 45 second Reels or TikTok script: a spoken hook with on-screen text, 3 to 6 beats each with voiceover and a short on-screen text overlay, and a spoken call to action. On-screen text is a 2 to 6 word summary, never a copy of the voiceover."),
    "youtube": (YouTubePackage, "a YouTube package: 5 title options under 70 characters, 3 thumbnail text options of 2 to 5 words, and a description of 80 to 150 words."),
}


class Repurpose(BaseModel):
    format: Literal["x_thread", "linkedin_post", "instagram_caption", "newsletter", "video_script", "youtube"]
    project: ProjectIn


@router.post("/repurpose")
def repurpose(body: Repurpose, user: dict = Depends(current_user)):
    schema, instruction = FORMATS[body.format]
    prompt = (
        f"{_voice(user['id'])}\n\nSource content:\n{_project_text(body.project)}\n\n"
        f"Turn this into {instruction} Keep every fact from the source and invent nothing."
    )
    return {"format": body.format, "data": _run(schema, prompt, max_tokens=1600)}


# ---- captions per platform ------------------------------------------------------------

PLATFORM_RULES = {
    "linkedin": "LinkedIn: 80 to 200 words, a hook first line, short paragraphs, a question or call to action, 3 to 5 hashtags.",
    "instagram": "Instagram: a hook first line, 50 to 150 words, a call to save or share, 5 to 10 hashtags.",
    "x": "X: under 240 characters in total including hashtags, punchy, 0 to 2 hashtags.",
    "threads": "Threads: under 400 characters, conversational, ends with a question, 0 or 1 hashtag.",
    "facebook": "Facebook: 40 to 120 words, friendly, a clear call to action, 0 to 3 hashtags.",
}


class Caption(BaseModel):
    caption: str = Field(max_length=2200)
    hashtags: list[Annotated[str, StringConstraints(max_length=30)]] = Field(max_length=10, description="without the # symbol")


class CaptionsRequest(BaseModel):
    platforms: list[Literal["linkedin", "instagram", "x", "threads", "facebook"]] = Field(min_length=1, max_length=5)
    project: ProjectIn


@router.post("/captions")
def captions(body: CaptionsRequest, user: dict = Depends(current_user)):
    platforms = list(dict.fromkeys(body.platforms))
    schema = create_model("PlatformCaptions", **{p: (Caption, ...) for p in platforms})
    rules = "\n".join(f"- {PLATFORM_RULES[p]}" for p in platforms)
    prompt = (
        f"{_voice(user['id'])}\n\nThe post:\n{_project_text(body.project)}\n\n"
        f"Write a separate caption for each platform, following each platform's rules:\n{rules}\n"
        "Return hashtags without the # symbol, separately from the caption text."
    )
    result = _run(schema, prompt, max_tokens=1800)
    if "x" in result:  # hard limit including hashtags, whatever the model did
        cap = result["x"]
        cap["hashtags"] = cap["hashtags"][:2]
        tags = " ".join(f"#{t}" for t in cap["hashtags"])
        cap["caption"] = _fit(cap["caption"], 280 - (len(tags) + 2 if tags else 0))
    return result


def _fit(text: str, limit: int) -> str:
    """Shorten to the last full sentence (or word) that fits."""
    if len(text) <= limit:
        return text
    cut = text[:limit]
    sentence_end = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    if sentence_end > limit * 0.5:
        return cut[: sentence_end + 1]
    return cut[: cut.rfind(" ")].rstrip(",;:") if " " in cut else cut


# ---- weekly plan --------------------------------------------------------------------


class PlanItem(BaseModel):
    day: int = Field(ge=0, le=13, description="days after the start date, 0 is the start date")
    title: str = Field(max_length=90)
    angle: str = Field(max_length=200)
    kind: Literal["carousel", "poster", "image", "text"]


class WeekPlanRequest(BaseModel):
    start: date
    days: int = Field(default=7, ge=1, le=14)
    posts: int = Field(default=4, ge=1, le=14)
    notes: _s(300) = ""


@router.post("/plan-week")
def plan_week(body: WeekPlanRequest, user: dict = Depends(current_user)):
    with connection() as conn:
        series = [
            r["data"]
            for r in conn.execute(
                "SELECT data FROM user_items WHERE user_id = %s AND kind = 'series'", (user["id"],)
            ).fetchall()
            if r["data"].get("active", True)
        ]
    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    calendar = ", ".join(
        f"day {i} is {weekdays[(body.start + timedelta(days=i)).weekday()]}" for i in range(body.days)
    )
    recurring = "; ".join(f"'{s['name']}' every {weekdays[s['weekday']]}: {s.get('prompt', '')}" for s in series)
    schema = create_model(
        "WeekPlan", items=(list[PlanItem], Field(min_length=1, max_length=body.posts))
    )
    prompt = (
        f"{_voice(user['id'])}\n\nPlan {body.posts} posts over {body.days} days ({calendar}). "
        "Spread them out, vary the formats, and mix the content types the creator posts. "
        + (f"Include one post for each recurring series on its weekday: {recurring}. " if recurring else "")
        + (f"Notes from the creator: {body.notes}. " if body.notes else "")
        + "Each item needs a specific, post-ready title and a one sentence angle."
    )
    result = _run(schema, prompt, temperature=0.7, max_tokens=1500)
    seen, items = set(), []
    for item in result["items"]:  # small models sometimes repeat an idea
        key = item["title"].strip().lower()
        if key in seen:
            continue
        seen.add(key)
        items.append({**item, "date": (body.start + timedelta(days=min(item["day"], body.days - 1))).isoformat()})
    return {"items": items}
