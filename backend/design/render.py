"""Turning sanitized unit HTML into pages, checking their layout, and exporting PDF and PNG.

Rendering runs headless Chromium with JavaScript off. The only network requests allowed are the
style's Google Fonts and Font Awesome; everything else is aborted.
"""

import html as _html
import io
import zipfile
from contextlib import contextmanager
from urllib.parse import urlparse

from design.formats import FORMATS
from design.sanitize import clean_html
from design.styles import FONT_AWESOME, fonts_url, style_css

ALLOWED_HOSTS = {"fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com"}
EXPORT_SCALE = 2


def initials(name: str) -> str:
    parts = [p for p in (name or "").split() if p[:1].isalpha()]
    return ("".join(p[0] for p in parts[:2]) or "A").upper()


def frame(fmt: str, inner_html: str, index: int, total: int, meta: dict) -> str:
    """One unit inside its page frame (author bar and footer where the format has them)."""
    f = FORMATS[fmt]
    esc = _html.escape
    classes = ["page"]
    parts = []
    if f["frame"]["topbar"]:
        classes.append("has-topbar")
        parts.append(
            f'<div class="topbar"><div class="avatar">{esc(initials(meta.get("author", "")))}</div>'
            f'<div class="author">{esc(meta.get("author", ""))}</div><div class="chev">&gt;&gt;&gt;</div></div>'
        )
    parts.append(f'<div class="content">{inner_html}</div>')
    if f["frame"]["footer"]:
        classes.append("has-footer")
        brand = esc(meta.get("brand") or meta.get("author") or "")
        parts.append(f'<div class="footer">{brand}{" · " if brand else ""}{index + 1} / {total}</div>')
    if f["height"] is None:
        classes.append("auto")
    return f'<div class="{" ".join(classes)}" data-unit="{index}">{"".join(parts)}</div>'


def head(fmt: str, style: str, extra_css: str = "") -> str:
    f = FORMATS[fmt]
    return (
        '<meta charset="utf-8">'
        f'<link rel="stylesheet" href="{fonts_url(style)}"><link rel="stylesheet" href="{FONT_AWESOME}">'
        f"<style>{style_css(style, f['width'], f['height'])}{extra_css}</style>"
    )


def unit_document(fmt: str, style: str, page_html: str) -> str:
    """A standalone document for one framed unit: what previews and checks render."""
    return f"<!doctype html><html><head>{head(fmt, style)}</head><body>{page_html}</body></html>"


def pages_for_export(fmt: str, units: list[dict], meta: dict) -> list[str]:
    """Framed pages in print order. Unit HTML is sanitized again here: never trust stored HTML."""
    total = len(units)
    framed = [frame(fmt, clean_html(u.get("html", ""), i), i, total, meta) for i, u in enumerate(units)]
    if fmt == "brochure":
        sheet = FORMATS["brochure"]["sheet"]
        return [
            f'<div class="sheet" style="display:flex;width:{sheet["width"]}px;height:{sheet["height"]}px">{"".join(framed[i] for i in order if i < total)}</div>'
            for order in sheet["pages"]
        ]
    if fmt == "infographic":
        return [f'<div class="sheet" style="width:{FORMATS[fmt]["width"]}px">{"".join(framed)}</div>']
    return framed


def export_document(fmt: str, style: str, units: list[dict], meta: dict) -> str:
    f = FORMATS[fmt]
    if fmt == "brochure":
        w, h = f["sheet"]["width"], f["sheet"]["height"]
    else:
        w, h = f["width"], f["height"]
    page_css = (
        "body{margin:0}.export-page{break-after:page;overflow:hidden}"
        + (f"@page{{size:{w}px {h}px;margin:0}}" if h else "")
    )
    body = "".join(f'<div class="export-page">{p}</div>' for p in pages_for_export(fmt, units, meta))
    return f"<!doctype html><html><head>{head(fmt, style, page_css)}</head><body>{body}</body></html>"


# ---- browser --------------------------------------------------------------------------------


def _route(route):
    host = urlparse(route.request.url).hostname or ""
    if route.request.url.startswith(("about:", "data:")) or host in ALLOWED_HOSTS:
        return route.continue_()
    return route.abort()


@contextmanager
def browser():
    """A headless Chromium for one job. Created per job so it stays on one thread."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        b = p.chromium.launch()
        try:
            yield b
        finally:
            b.close()


def _page(b, width: int, height: int):
    context = b.new_context(viewport={"width": width, "height": height}, device_scale_factor=EXPORT_SCALE, java_script_enabled=False)
    context.route("**/*", _route)
    return context, context.new_page()


_MEASURE = """() => {
  const page = document.querySelector('.page'); const pr = page.getBoundingClientRect();
  const content = page.querySelector('.content'); const cr = content.getBoundingClientRect();
  const limit = page.classList.contains('auto') ? Infinity : pr.bottom - (page.classList.contains('has-footer') ? 24 : 0);
  const main = content.querySelector(':scope > .body, :scope > .cover') || content;
  let bottom = cr.top, overflowY = 0, overflowX = 0, clipped = 0;
  for (const el of content.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    bottom = Math.max(bottom, r.bottom);
    overflowY = Math.max(overflowY, r.bottom - limit); overflowX = Math.max(overflowX, r.right - pr.right, pr.left - r.left);
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow === 'hidden') clipped++;
  }
  const kids = [...main.children].map(c => c.getBoundingClientRect()).filter(r => r.height);
  let slack = 0; for (let i = 1; i < kids.length; i++) slack += Math.max(0, kids[i].top - kids[i-1].bottom - 16);
  // The body stretches to fill the page, so empty space is measured from its last child, not from itself.
  const lastKid = kids.length ? Math.max(...kids.map(r => r.bottom)) : cr.top;
  const empty = page.classList.contains('auto') ? 0 : Math.max(0, limit - lastKid - 14);
  return {overflowY: Math.round(Math.max(0, overflowY)), overflowX: Math.round(Math.max(0, overflowX)),
          empty: Math.round(empty + slack), height: Math.round(page.getBoundingClientRect().height), clipped,
          hasBand: !!content.querySelector('.band'), hasCover: !!content.querySelector('.cover'), blocks: kids.length};
}"""


def check_layout(b, fmt: str, style: str, page_html: str) -> dict:
    """Render one unit and measure overflow and empty space (the prompts' verify step)."""
    f = FORMATS[fmt]
    context, page = _page(b, f["width"], f["height"] or 1200)
    try:
        page.set_content(unit_document(fmt, style, page_html), wait_until="networkidle", timeout=20_000)
        return page.evaluate(_MEASURE)
    finally:
        context.close()


def layout_feedback(fmt: str, metrics: dict, role: str = "") -> str:
    """What to fix, in words the model can act on. Empty string when the page is fine."""
    problems = []
    if role == "cover" and fmt in ("carousel", "slides") and not metrics.get("hasCover", True):
        problems.append('This is the cover: use <div class="cover"> with a kicker, a big title with one highlighted word, a hero visual, chips, and the byline, and no title band.')
    if metrics.get("overflowY", 0) > 6:
        problems.append(f"The content runs {metrics['overflowY']} px past the bottom of the page. Cut text or remove one block so everything fits.")
    if metrics.get("overflowX", 0) > 6:
        problems.append(f"Something is {metrics['overflowX']} px wider than the page. Use fewer columns or shorter labels.")
    limit = 90 if FORMATS[fmt]["height"] and FORMATS[fmt]["height"] < 900 else 160
    if metrics.get("empty", 0) > limit:
        problems.append(
            f"About {metrics['empty']} px of the page is empty. Add a supporting element (chips, a stat card, a divider with summary cards, or a small table) using facts from the content."
        )
    if FORMATS[fmt]["height"] is None and metrics.get("height", 0) > 520:
        problems.append(f"This section is {metrics['height']} px tall. Keep it under 420 px: fewer items, shorter text.")
    return " ".join(problems)


def export_files(fmt: str, style: str, units: list[dict], meta: dict, kind: str) -> tuple[bytes, str, str]:
    """(file bytes, media type, file extension). kind is pdf or png (a ZIP when there are several pages)."""
    f = FORMATS[fmt]
    if fmt == "brochure":
        w, h = f["sheet"]["width"], f["sheet"]["height"]
    else:
        w, h = f["width"], f["height"]
    with browser() as b:
        context, page = _page(b, w, h or 1200)
        try:
            page.set_content(export_document(fmt, style, units, meta), wait_until="networkidle", timeout=30_000)
            if kind == "pdf":
                if h is None:  # infographic: one page as tall as the content
                    h = page.evaluate("() => Math.ceil(document.querySelector('.sheet').getBoundingClientRect().height)")
                    data = page.pdf(width=f"{w}px", height=f"{h}px", print_background=True, margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
                else:
                    data = page.pdf(width=f"{w}px", height=f"{h}px", print_background=True, prefer_css_page_size=True)
                return data, "application/pdf", "pdf"
            shots = [el.screenshot(type="png") for el in page.query_selector_all(".export-page > *")]
        finally:
            context.close()
    if len(shots) == 1:
        return shots[0], "image/png", "png"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for i, shot in enumerate(shots, start=1):
            z.writestr(f"{fmt}-{i:02d}.png", shot)
    return buf.getvalue(), "application/zip", "zip"
