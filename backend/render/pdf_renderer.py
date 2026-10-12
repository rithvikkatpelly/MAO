"""HTML -> PDF rendering. Not an agent — deterministic screenshot + assembly.

Each slide's HTML (from render/templates.py) is screenshotted at its exact
platform pixel size, then the screenshots are stitched into one PDF.
"""

import threading

import img2pdf
from playwright.sync_api import sync_playwright

_playwright = None
_browser = None
_lock = threading.Lock()


def _get_browser():
    global _playwright, _browser
    with _lock:
        if _browser is None:
            _playwright = sync_playwright().start()
            _browser = _playwright.chromium.launch()
    return _browser


def render_slides_to_pdf(html_pages: list[str], width: int, height: int) -> bytes:
    browser = _get_browser()
    # Slides are self-contained and escaped, but the renderer still runs with no script and no
    # network, so nothing in a slide could ever execute or reach another host.
    context = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=2,
        java_script_enabled=False,
        offline=True,
    )
    context.route("**/*", lambda route: route.abort())
    page = context.new_page()
    try:
        images = []
        for html_content in html_pages[:20]:
            page.set_content(html_content, wait_until="load", timeout=15_000)
            images.append(page.screenshot(type="png", timeout=15_000))
    finally:
        context.close()
    return img2pdf.convert(images)
