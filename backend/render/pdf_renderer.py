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
    page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=2)
    try:
        images = []
        for html_content in html_pages:
            page.set_content(html_content, wait_until="networkidle")
            images.append(page.screenshot(type="png"))
    finally:
        page.close()
    return img2pdf.convert(images)
