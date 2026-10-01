"""Tools for the Content Agent: turn research + brand context into a carousel."""

from typing import Annotated

from langchain_core.tools import tool
from pydantic import BaseModel, Field, create_model

from llm import invoke_structured
from text_rules import STYLE_RULE

# Every string is length-bounded in the schema: constrained decoding limits the JSON
# shape but not free text, and an unbounded string can make the model loop for minutes.
Hashtag = Annotated[str, Field(max_length=30)]


class CarouselSlide(BaseModel):
    index: int = Field(description="1-based slide number")
    headline: str = Field(max_length=90, description="punchy slide headline, under 8 words")
    body: str = Field(max_length=200, description="slide body copy, one or two short sentences, under 25 words")


class CarouselContent(BaseModel):
    platform: str = Field(max_length=20, description="target platform, e.g. linkedin")
    title: str = Field(max_length=80, description="short internal working title")
    slides: list[CarouselSlide] = Field(description="the ordered slides")
    caption: str = Field(max_length=200, description="post caption, under 30 words, with no hashtags in it")
    hashtags: list[Hashtag] = Field(
        min_length=3, max_length=5, description="3 to 5 hashtags, without the # symbol"
    )
    cta: str = Field(max_length=120, description="the specific call to action, one short sentence")


class ValidationResult(BaseModel):
    is_valid: bool = Field(description="whether the carousel meets platform and brand guidelines")
    issues: list[str] = Field(description="specific problems found, empty if is_valid is true")
    revised: CarouselContent | None = Field(
        default=None, description="a corrected version of the carousel, if issues were found"
    )


def _carousel_schema_for(slide_count: int) -> type[BaseModel]:
    """A CarouselContent variant whose `slides` list is hard-constrained to
    exactly slide_count items in the JSON schema (Ollama enforces this at
    decode time), instead of just hoping the model reads the prompt."""
    return create_model(
        "CarouselContentFixed",
        __base__=CarouselContent,
        slides=(
            list[CarouselSlide],
            Field(min_length=slide_count, max_length=slide_count, description="the ordered slides"),
        ),
    )


def _coerce_slide_count(carousel: CarouselContent, slide_count: int) -> CarouselContent:
    """Defensive fallback: if the model still returned the wrong count, truncate/pad."""
    slides = list(carousel.slides)[:slide_count]
    while len(slides) < slide_count:
        slides.append(slides[-1] if slides else CarouselSlide(index=1, headline=carousel.title, body=""))
    for i, slide in enumerate(slides, start=1):
        slide.index = i
    return carousel.model_copy(update={"slides": slides})


_FORMAT_INSTRUCTIONS = {
    "carousel": (
        "Write a {n}-slide carousel: slide 1 is a scroll-stopping hook, the middle slides "
        "each build one idea, and the final slide has a clear call to action."
    ),
    "single": (
        "Write ONE single-image feed post (exactly {n} slide). The headline is the bold text "
        "overlaid on the image; the body is a short supporting line under 120 characters."
    ),
    "thumbnail": (
        "Write ONE YouTube thumbnail (exactly {n} slide). The headline is 2 to 5 huge, "
        "curiosity-driven words; the body is an optional supporting line under 40 characters."
    ),
    "card": (
        "Write ONE X/Twitter card (exactly {n} slide). The headline is the card title "
        "(under 70 characters); the body is the card description (under 200 characters). "
        "Keep it terse and direct."
    ),
}


@tool
def generate_carousel_content(
    idea: str,
    research_notes: str,
    brand_notes: str,
    platform: str,
    slide_count: int,
    format_hint: str,
) -> CarouselContent:
    """Generate structured content (slides, caption, hashtags, CTA) from an idea.

    Args:
        idea: The selected content idea/title to build the content around.
        research_notes: Key facts and context gathered by the research agents.
        brand_notes: Brand tone, audience, and platform guidelines to follow.
        platform: The target platform (e.g. "LinkedIn").
        slide_count: The exact number of slides/cards to produce.
        format_hint: The output shape — "carousel", "single", or "card".
    """
    format_instructions = _FORMAT_INSTRUCTIONS.get(format_hint, _FORMAT_INSTRUCTIONS["carousel"]).format(
        n=slide_count
    )
    prompt = (
        f"Create {platform} content for this idea: {idea}\n\n"
        f"{format_instructions}\n\n"
        f"Key facts:\n{research_notes}\n\n"
        f"Brand and platform guidelines:\n{brand_notes}\n\n"
        f"The slides array MUST contain exactly {slide_count} item(s), numbered from 1.\n"
        f"{STYLE_RULE}"
    )
    result = invoke_structured(_carousel_schema_for(slide_count), prompt, temperature=0.4, max_tokens=1000)
    return _coerce_slide_count(CarouselContent(**result.model_dump()), slide_count)


def _rule_issues(carousel: CarouselContent, char_limit: int, avoid_words: list[str]) -> list[str]:
    issues = []
    text = " ".join([s.headline + " " + s.body for s in carousel.slides] + [carousel.caption, carousel.cta]).lower()
    used = [w for w in avoid_words if w.strip() and w.lower() in text]
    if used:
        issues.append("remove these words the creator never uses: " + ", ".join(used))
    for slide in carousel.slides:
        if not slide.headline.strip() or not slide.body.strip():
            issues.append(f"slide {slide.index} has an empty headline or body")
        elif len(slide.body) > char_limit:
            issues.append(f"slide {slide.index} body is {len(slide.body)} characters; the limit is {char_limit}")
    if not carousel.cta.strip():
        issues.append("the call to action is empty")
    return issues


@tool
def validate_and_refine(
    carousel: CarouselContent, brand_notes: str, slide_count: int, char_limit: int, avoid_words: list[str] | None = None
) -> ValidationResult:
    """Check a carousel against the platform rules and rewrite it only if something is wrong.

    Args:
        carousel: The carousel content to validate.
        brand_notes: The brand and platform guidelines it must follow.
        slide_count: The exact number of slides the carousel must have.
        char_limit: Maximum characters allowed in a slide body.
        avoid_words: Words or phrases the creator never wants to use.
    """
    issues = _rule_issues(carousel, char_limit, avoid_words or [])
    if not issues:
        return ValidationResult(is_valid=True, issues=[])

    result = invoke_structured(
        _carousel_schema_for(slide_count),
        f"Guidelines:\n{brand_notes}\n\n"
        f"Carousel:\n{carousel.model_dump_json(indent=2)}\n\n"
        "Fix these problems and keep everything else, including the number of slides:\n- "
        + "\n- ".join(issues),
        temperature=0,
        max_tokens=1000,
    )
    revised = _coerce_slide_count(CarouselContent(**result.model_dump()), slide_count)
    return ValidationResult(is_valid=False, issues=issues, revised=revised)


CONTENT_TOOLS = [generate_carousel_content, validate_and_refine]
