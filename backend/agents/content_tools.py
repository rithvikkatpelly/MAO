"""Tools for the Content Agent: turn research + brand context into a carousel."""

from langchain_core.tools import tool
from pydantic import BaseModel, Field, create_model

from llm import get_llm


class CarouselSlide(BaseModel):
    index: int = Field(description="1-based slide number")
    headline: str = Field(description="short, punchy slide headline")
    body: str = Field(description="1-2 sentence slide body copy")
    visual_note: str = Field(description="a short note on what image/graphic should accompany this slide")


class CarouselContent(BaseModel):
    platform: str = Field(description="target platform, e.g. LinkedIn")
    title: str = Field(description="internal working title for the carousel")
    slides: list[CarouselSlide] = Field(description="the ordered carousel slides")
    caption: str = Field(description="the post caption to accompany the carousel")
    hashtags: list[str] = Field(description="hashtags to include, without the # symbol")
    cta: str = Field(description="the specific call to action for the final slide/caption")


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
        slides.append(slides[-1] if slides else CarouselSlide(index=1, headline=carousel.title, body="", visual_note=""))
    for i, slide in enumerate(slides, start=1):
        slide.index = i
    return carousel.model_copy(update={"slides": slides})


_FORMAT_INSTRUCTIONS = {
    "carousel": (
        "Write a {n}-slide carousel: slide 1 is a scroll-stopping hook, the middle slides "
        "each build one idea, and the final slide has a clear call to action."
    ),
    "single": (
        "Write ONE Instagram feed post (exactly {n} slide). The headline is the bold text "
        "overlaid on the image; the body is a short supporting caption line. In visual_note, "
        "name a layout style for it: quote, bold-statement, stat-callout, or list."
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
    schema = _carousel_schema_for(slide_count)
    llm = get_llm(temperature=0.4).with_structured_output(schema)
    format_instructions = _FORMAT_INSTRUCTIONS.get(format_hint, _FORMAT_INSTRUCTIONS["carousel"]).format(
        n=slide_count
    )
    prompt = (
        f"Create {platform} content for this idea: {idea}\n\n"
        f"{format_instructions}\n\n"
        f"Research notes:\n{research_notes}\n\n"
        f"Brand and platform guidelines:\n{brand_notes}\n\n"
        f"The slides array MUST contain exactly {slide_count} item(s), numbered from 1."
    )
    result = llm.invoke(prompt)
    carousel = CarouselContent(**result.model_dump())
    return _coerce_slide_count(carousel, slide_count)


@tool
def validate_and_refine(carousel: CarouselContent, brand_notes: str, slide_count: int) -> ValidationResult:
    """Check a generated carousel against brand/platform guidelines and fix it if needed.

    Args:
        carousel: The carousel content to validate.
        brand_notes: The brand and platform guidelines it must follow.
        slide_count: The exact number of slides the carousel must have.
    """
    schema = _carousel_schema_for(slide_count)
    result_schema = create_model(
        "ValidationResultFixed",
        __base__=ValidationResult,
        revised=(schema | None, Field(default=None, description="a corrected carousel, if issues were found")),
    )
    llm = get_llm(temperature=0).with_structured_output(result_schema)
    prompt = (
        f"Guidelines:\n{brand_notes}\n\n"
        f"Carousel to review:\n{carousel.model_dump_json(indent=2)}\n\n"
        f"Check tone and CTA against the guidelines, and confirm it has exactly {slide_count} "
        "slide(s) — do not change the slide count. If anything is off, set is_valid to false, "
        "list the issues, and provide a corrected 'revised' carousel with the SAME number of "
        "slides. If it already meets the guidelines, set is_valid to true and leave revised empty."
    )
    result = llm.invoke(prompt)
    revised = None
    if result.revised is not None:
        revised = _coerce_slide_count(CarouselContent(**result.revised.model_dump()), slide_count)
    return ValidationResult(is_valid=result.is_valid, issues=result.issues, revised=revised)


CONTENT_TOOLS = [generate_carousel_content, validate_and_refine]
