"""Deterministic HTML rendering for carousel/card slides.

Not an LLM step — the Design Agent picks the template name, this module
turns (slide, template, size) into a self-contained HTML page that
render/pdf_renderer.py screenshots. Colors mirror the frontend's Tailwind
tokens (see frontend/src/index.css) so PDF output matches the site.
"""

import html

_COLORS = {
    "modern": {"bg": "#0b1224", "bg2": "#16234a", "text": "#ffffff", "sub": "rgba(255,255,255,0.65)", "cta_bg": "#ff5a3c", "cta_text": "#ffffff"},
    "minimal": {"bg": "#ffffff", "bg2": "#fdf6ef", "text": "#0b1224", "sub": "rgba(11,18,36,0.55)", "cta_bg": "#0b1224", "cta_text": "#ffffff"},
    "tech-blue": {"bg": "#0a66c2", "bg2": "#0952a0", "text": "#ffffff", "sub": "rgba(255,255,255,0.75)", "cta_bg": "#ffffff", "cta_text": "#0a66c2"},
    "corporate": {"bg": "#1e2f5e", "bg2": "#16234a", "text": "#ffffff", "sub": "rgba(255,255,255,0.65)", "cta_bg": "#ff5a3c", "cta_text": "#ffffff"},
    "gradient": {"bg": "#ff5a3c", "bg2": "#a855f7", "text": "#ffffff", "sub": "rgba(255,255,255,0.85)", "cta_bg": "#ffffff", "cta_text": "#a855f7"},
}

TEMPLATE_NAMES = list(_COLORS.keys())

_FONT_STACK = (
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
)


def render_slide_html(
    slide,
    template: str,
    width: int,
    height: int,
    index: int,
    total: int,
    cta: str | None = None,
) -> str:
    colors = _COLORS.get(template, _COLORS["modern"])
    headline_size = round(width * 0.058)
    body_size = round(width * 0.026)
    pad = round(width * 0.08)
    badge_size = round(width * 0.024)

    headline = html.escape(slide.headline)
    body = html.escape(slide.body)
    cta_html = (
        f'<div style="margin-top:{round(width*0.04)}px;display:inline-block;'
        f'padding:{round(width*0.02)}px {round(width*0.035)}px;border-radius:999px;'
        f'background:{colors["cta_bg"]};color:{colors["cta_text"]};'
        f'font-weight:700;font-size:{round(width*0.022)}px;">{html.escape(cta)}</div>'
        if cta
        else ""
    )

    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html, body {{ width: {width}px; height: {height}px; }}
  body {{
    font-family: {_FONT_STACK};
    background: linear-gradient(135deg, {colors["bg"]}, {colors["bg2"]});
    color: {colors["text"]};
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: {pad}px;
  }}
  .top-row {{ display: flex; align-items: center; justify-content: space-between; }}
  .badge {{
    font-size: {badge_size}px;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: {round(badge_size*0.5)}px {round(badge_size*1.1)}px;
    border-radius: 999px;
    background: rgba(255,255,255,0.14);
    color: {colors["text"]};
  }}
  .brand {{
    font-size: {badge_size}px;
    font-weight: 700;
    color: {colors["sub"]};
  }}
  .headline {{
    font-size: {headline_size}px;
    font-weight: 800;
    line-height: 1.12;
    letter-spacing: -0.02em;
    margin-bottom: {round(width*0.025)}px;
  }}
  .body {{
    font-size: {body_size}px;
    line-height: 1.45;
    color: {colors["sub"]};
    max-width: 92%;
  }}
</style>
</head>
<body>
  <div class="top-row">
    <span class="badge">{index:02d} / {total:02d}</span>
    <span class="brand">AUREA STUDIO</span>
  </div>
  <div>
    <div class="headline">{headline}</div>
    <div class="body">{body}</div>
    {cta_html}
  </div>
</body>
</html>"""
