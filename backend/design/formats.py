"""The five output formats: canvas sizes, how a design splits into units the model writes one
at a time, the frame around each unit, and the structure each format follows.

All sizes are CSS pixels. Exports render at 2x (a 540 x 675 carousel page becomes 1080 x 1350).
"""

FORMATS: dict[str, dict] = {
    "carousel": {
        "label": "Carousel",
        "description": "Portrait LinkedIn and Instagram carousel, exported as a PDF document and PNG images",
        "unit": "slide",
        "width": 540,
        "height": 675,
        "count": {"min": 5, "max": 15, "default": 8},
        "frame": {"topbar": True, "footer": True},
        "usable": "about 520 px of height under the title band and 488 px of width",
        "structure": [
            ("cover", "Cover: a kicker, a 2 to 3 line title with one huge highlighted word, a one-line subtitle, a hero visual that explains the topic at a glance, 3 chips naming what the carousel covers, a byline and 'Swipe >>>'"),
            ("body", "One idea per slide, taught with a visual: comparison cards, steps, a table, bars, a timeline, or stat cards. A subtitle states the point and a quote box holds the takeaway"),
            ("closing", "Cheat sheet: 3 to 5 rules ('If you... use X'), a one-line memorable close, a soft question as the call to action, and a tiny sources line"),
        ],
    },
    "slides": {
        "label": "Presentation",
        "description": "16:9 slide deck, exported as a PDF and PNG images",
        "unit": "slide",
        "width": 960,
        "height": 540,
        "count": {"min": 5, "max": 20, "default": 10},
        "frame": {"topbar": False, "footer": True},
        "usable": "about 400 px of height under the title band and 900 px of width; use the width with 2 or 3 columns",
        "structure": [
            ("cover", "Title slide: kicker, big title with one highlighted word, subtitle, presenter name, and a hero visual on the right half"),
            ("agenda", "Agenda: 3 to 6 numbered steps or cards naming the sections"),
            ("body", "One message per slide, left-to-right layouts: a visual on one side and 2 or 3 supporting cards on the other, or a full-width diagram, table, or chart. A takeaway quote at the bottom"),
            ("section", "Section divider: a large section number, the section title, and one line on what it covers"),
            ("closing", "Summary: 3 to 5 key takeaways as cards, a closing line, and the next step or question for the audience"),
        ],
    },
    "infographic": {
        "label": "Infographic",
        "description": "One tall vertical infographic, exported as a single-page PDF and a PNG",
        "unit": "section",
        "width": 800,
        "height": None,  # sections stack; the page is as tall as its content
        "section_height": "between 260 and 420 px tall",
        "count": {"min": 4, "max": 8, "default": 6},
        "frame": {"topbar": False, "footer": False},
        "usable": "760 px of width; keep the section between 260 and 420 px tall",
        "structure": [
            ("header", "Header: the title band, a one-line subtitle, and 2 or 3 big headline numbers or chips that sum up the topic"),
            ("body", "One section per idea, alternating visuals so the page flows: stat row, bar chart, process steps, comparison, timeline, icon grid. Each section has a pill label and one-line takeaway"),
            ("closing", "Footer section: the key takeaway in a quote box, 3 action chips, and a tiny sources line"),
        ],
    },
    "flyer": {
        "label": "Flyer",
        "description": "A4 portrait flyer for print or sharing, exported as a PDF and a PNG",
        "unit": "page",
        "width": 794,
        "height": 1123,
        "count": {"min": 1, "max": 1, "default": 1},
        "frame": {"topbar": False, "footer": False},
        "usable": "the whole 794 x 1123 px page; keep 40 px margins",
        "structure": [
            ("flyer", "One page, top to bottom: a kicker, a huge headline with one highlighted word, a one-line promise, a hero visual, 3 benefit cards with icons, the key details (date, time, place, price or offer) as a bold block, a clear call to action, and contact details in small print"),
        ],
    },
    "brochure": {
        "label": "Brochure",
        "description": "Tri-fold brochure on US Letter landscape: 6 panels on 2 printed sides, exported as a 2-page PDF and PNGs",
        "unit": "panel",
        "width": 352,
        "height": 816,
        "count": {"min": 6, "max": 6, "default": 6},
        "frame": {"topbar": False, "footer": False},
        "usable": "352 x 816 px per panel; keep 24 px margins and do not put anything in the outer 12 px (the fold)",
        "sheet": {"width": 1056, "height": 816, "pages": [[4, 5, 0], [1, 2, 3]]},  # outside, inside (0-based panels)
        "structure": [
            ("cover", "Panel 1, front cover: brand, a big title, one-line promise, and a hero visual"),
            ("inside", "Panel 2, inside left: the problem or why it matters, with a stat card and 2 cards"),
            ("inside", "Panel 3, inside middle: how it works, as numbered steps or a process"),
            ("inside", "Panel 4, inside right: benefits or offerings, as icon cards, with a quote"),
            ("flap", "Panel 5, inside flap (seen first when opened): a teaser, 3 key facts as chips or stats, and a testimonial-style quote only if the content provides one"),
            ("back", "Panel 6, back: call to action, contact details, and a small 'about' line"),
        ],
    },
}

FORMAT_IDS = tuple(FORMATS)


def unit_label(fmt: str, index: int, total: int) -> str:
    f = FORMATS[fmt]
    if fmt == "brochure":
        return f"panel {index + 1}"
    return f"{f['unit']} {index + 1} of {total}"


def default_roles(fmt: str, count: int) -> list[str]:
    """The role of each unit in order, following the format's structure."""
    if fmt == "brochure":
        return [role for role, _ in FORMATS["brochure"]["structure"]]
    if fmt == "flyer":
        return ["flyer"]
    roles = [FORMATS[fmt]["structure"][0][0]]
    if fmt == "slides" and count >= 7:
        roles.append("agenda")
    while len(roles) < count - 1:
        roles.append("body")
    roles.append("closing")
    return roles[:count]


def role_guide(fmt: str, role: str, index: int) -> str:
    structure = FORMATS[fmt]["structure"]
    if fmt == "brochure":
        return structure[index][1]
    for r, text in structure:
        if r == role:
            return text
    return next(text for r, text in structure if r == "body")
