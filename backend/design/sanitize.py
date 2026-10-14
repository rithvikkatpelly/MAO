"""Sanitizing model-written HTML.

The design model writes HTML that is shown in the browser and rendered by headless Chromium, and
its input includes web research, so its output is treated as untrusted:
  - an allowlist of layout, text, table, and SVG elements; no script, style, link, img, iframe,
    form, or anchor elements, and no event handlers;
  - inline styles limited to layout and typography properties, with every url() removed except
    url(#id), which SVG arrowheads need;
  - ids prefixed per unit so two pages never clash.
Previews also run in a sandboxed iframe with no scripts, and exports run with JavaScript off and a
network allowlist of font hosts, so a missed case still cannot execute or call out.
"""

import html as _html
import re

import nh3

from guardrails.sanitize import normalize

TAGS = {
    "div", "span", "p", "h1", "h2", "h3", "h4", "ul", "ol", "li", "b", "strong", "em", "i", "u", "s", "br", "small", "sup", "sub",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "hr", "blockquote", "figure", "figcaption",
    "svg", "g", "defs", "marker", "path", "line", "polyline", "polygon", "rect", "circle", "ellipse", "text", "tspan", "title",
}

SVG_ATTRS = {
    "viewBox", "width", "height", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "d", "points",
    "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "stroke-opacity",
    "opacity", "transform", "marker-end", "marker-start", "marker-mid", "text-anchor", "dominant-baseline", "font-size",
    "font-weight", "font-family", "refX", "refY", "markerWidth", "markerHeight", "orient", "markerUnits", "preserveAspectRatio", "dx", "dy",
}

ATTRIBUTES = {
    "*": {"class", "style", "id", "aria-hidden", "role"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan"},
    **{tag: SVG_ATTRS for tag in ("svg", "g", "marker", "path", "line", "polyline", "polygon", "rect", "circle", "ellipse", "text", "tspan")},
}

STYLE_PROPERTIES = {
    "width", "height", "min-width", "max-width", "min-height", "max-height", "margin", "margin-top", "margin-bottom", "margin-left",
    "margin-right", "padding", "padding-top", "padding-bottom", "padding-left", "padding-right", "gap", "row-gap", "column-gap",
    "display", "flex", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "align-items", "align-self",
    "justify-content", "justify-self", "align-content", "order", "grid-template-columns", "grid-template-rows", "grid-column",
    "grid-row", "position", "top", "left", "right", "bottom", "z-index", "transform", "text-align", "vertical-align",
    "font-size", "font-weight", "font-style", "font-family", "line-height", "letter-spacing", "text-transform", "white-space",
    "color", "background", "background-color", "border", "border-top", "border-bottom", "border-left", "border-right",
    "border-color", "border-width", "border-style", "border-radius", "box-shadow", "opacity", "overflow", "fill", "stroke",
    "stroke-width", "text-decoration", "list-style", "aspect-ratio", "object-fit",
}

_URL = re.compile(r"url\(\s*(?!['\"]?#)[^)]*\)", re.IGNORECASE)
_BAD_CSS = re.compile(r"expression\s*\(|javascript:|@import|behavior\s*:|-moz-binding", re.IGNORECASE)
_FENCE = re.compile(r"^```[a-zA-Z]*\s*|\s*```$", re.MULTILINE)


def _attribute_filter(prefix: str):
    def keep(_element: str, attribute: str, value: str) -> str | None:
        if _BAD_CSS.search(value):
            return None
        if attribute == "style" or attribute.startswith(("marker", "fill", "stroke")):
            value = _URL.sub("none", value)
        if attribute == "style":  # fixed elements would repeat on every page of a PDF
            value = re.sub(r"position\s*:\s*(fixed|sticky)", "position:absolute", value, flags=re.IGNORECASE)
        if attribute == "id":
            return f"{prefix}{re.sub(r'[^A-Za-z0-9_-]', '', value)[:40]}"
        if attribute.startswith("marker") or attribute in ("fill", "stroke"):
            value = re.sub(r"url\(\s*['\"]?#([A-Za-z0-9_-]+)['\"]?\s*\)", lambda m: f"url(#{prefix}{m.group(1)})", value)
        return value

    return keep


def extract_html(raw: str) -> str:
    """The HTML out of a model reply: code fences and any text before the first tag removed."""
    text = _FENCE.sub("", normalize(raw or "").strip())
    start = text.find("<")
    return text[start:] if start >= 0 else ""


def clean_html(raw: str, unit_index: int = 0) -> str:
    html = extract_html(raw)
    return nh3.clean(
        html,
        tags=TAGS,
        clean_content_tags={"script", "style", "iframe", "object", "noscript", "template", "textarea", "select"},
        attributes=ATTRIBUTES,
        attribute_filter=_attribute_filter(f"u{unit_index}-"),
        filter_style_properties=STYLE_PROPERTIES,
        strip_comments=True,
        url_schemes=set(),
        link_rel=None,
    ).strip()


def visible_text(html: str) -> str:
    """The words a reader sees, for moderation and fact checks."""
    text = _html.unescape(re.sub(r"<[^>]+>", " ", html or ""))
    return re.sub(r"\s+", " ", text).strip()
