"""Per-platform output format: slide count, pixel size, and default template."""

PLATFORM_SPECS = {
    "linkedin": {
        "format": "carousel",
        "slide_count": 6,
        "width": 1080,
        "height": 1080,
        "default_template": "corporate",
    },
    "instagram": {
        "format": "single",
        "slide_count": 1,
        "width": 1080,
        "height": 1350,
        "default_template": "gradient",
    },
    "x": {
        "format": "card",
        "slide_count": 1,
        "width": 1200,
        "height": 675,
        "default_template": "tech-blue",
    },
}


def get_platform_spec(platform: str) -> dict:
    return PLATFORM_SPECS.get(platform.lower(), PLATFORM_SPECS["linkedin"])
