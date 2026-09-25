"""Tools for the Design Agent: pick a template, then render each slide to HTML."""

from typing import Literal

from langchain_core.tools import tool
from pydantic import BaseModel, Field

from agents.content_tools import CarouselContent
from llm import get_llm
from platform_specs import get_platform_spec
from render.templates import TEMPLATE_NAMES, render_slide_html

DesignTemplate = Literal["modern", "minimal", "tech-blue", "corporate", "gradient"]


class DesignChoice(BaseModel):
    template: DesignTemplate = Field(description="the template style that best fits the content's tone")
    reason: str = Field(description="one short sentence on why this template fits")


@tool
def select_design(carousel: CarouselContent, platform: str) -> DesignChoice:
    """Pick the template that best fits this content's tone and platform.

    Args:
        carousel: The generated carousel content to design for.
        platform: The target platform (e.g. "LinkedIn").
    """
    spec = get_platform_spec(platform)
    llm = get_llm(temperature=0.2).with_structured_output(DesignChoice)
    prompt = (
        f"Available templates: {', '.join(TEMPLATE_NAMES)}.\n"
        f"Default for {platform} is '{spec['default_template']}' — only deviate if the "
        f"content's tone clearly calls for something else.\n\n"
        f"Title: {carousel.title}\n"
        f"First slide headline: {carousel.slides[0].headline}\n"
        f"Caption: {carousel.caption}\n\n"
        "Pick the single best-fit template."
    )
    return llm.invoke(prompt)


@tool
def render_html(carousel: CarouselContent, platform: str, template: DesignTemplate) -> list[str]:
    """Render each slide of the carousel to a self-contained, platform-sized HTML page.

    Args:
        carousel: The generated carousel content to render.
        platform: The target platform (e.g. "LinkedIn"), used for pixel dimensions.
        template: The template style to render with.
    """
    spec = get_platform_spec(platform)
    total = len(carousel.slides)
    return [
        render_slide_html(
            slide=slide,
            template=template,
            width=spec["width"],
            height=spec["height"],
            index=slide.index,
            total=total,
            cta=carousel.cta if slide.index == total else None,
        )
        for slide in carousel.slides
    ]


DESIGN_TOOLS = [select_design, render_html]
