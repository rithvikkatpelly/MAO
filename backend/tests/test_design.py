"""The AI design studio: sanitizer, formats, prompt files, and the API flow with a fake model."""

import io
import json
import re
import zipfile
from pathlib import Path

import pytest

from conftest import needs_db
from design.formats import FORMATS, default_roles
from design.render import frame, layout_feedback
from design.sanitize import clean_html, visible_text

ORIGIN = {"Origin": "http://localhost:5173"}

# ---- sanitizer ------------------------------------------------------------------------------------


def test_sanitizer_strips_everything_that_can_run_or_call_out():
    raw = """Here you go:
```html
<div class="band" onclick="x()"><h1>Hi</h1></div><script>fetch('//evil')</script><style>*{}</style>
<div style="background:url(https://evil.example/a.png);width:40%;position:fixed;width:expression(1)">a</div>
<a href="javascript:alert(1)">link</a><img src=x onerror=alert(1)><iframe src=//x></iframe><form><input></form>
<svg viewBox="0 0 10 10"><defs><marker id="m"><path d="M0 0L5 5"/></marker></defs><line x2="5" marker-end="url(#m)"/><image href="//x"/></svg>
```"""
    out = clean_html(raw, 2)
    for bad in ("script", "onclick", "evil", "javascript", "<img", "<iframe", "<form", "<input", "expression", "<image", "<style", "fixed"):
        assert bad not in out, bad
    assert 'id="u2-m"' in out and "url(#u2-m)" in out and 'viewBox="0 0 10 10"' in out
    assert visible_text(out) == "Hi a link"


def test_formats_roles_and_brochure_panels():
    assert default_roles("carousel", 6) == ["cover", "body", "body", "body", "body", "closing"]
    assert default_roles("slides", 8)[:2] == ["cover", "agenda"]
    assert default_roles("flyer", 1) == ["flyer"]
    assert len(default_roles("brochure", 6)) == 6
    sheet = FORMATS["brochure"]["sheet"]
    assert sorted(i for page in sheet["pages"] for i in page) == list(range(6))


def test_frame_escapes_author_and_brand():
    page = frame("carousel", "<div class='body'>x</div>", 0, 3, {"author": "<b>Eve</b>", "brand": "A&B"})
    assert "&lt;b&gt;Eve" in page and "A&amp;B · 1 / 3" in page


def test_layout_feedback_names_the_problem():
    assert "past the bottom" in layout_feedback("carousel", {"overflowY": 40, "empty": 0})
    assert "empty" in layout_feedback("carousel", {"overflowY": 0, "empty": 200})
    assert layout_feedback("carousel", {"overflowY": 0, "empty": 20}) == ""


def test_prompt_files_copy_each_style_word_for_word():
    root = Path(__file__).resolve().parents[2] / "Design Prompts"
    for style_file in sorted(root.glob("0*_*.md")):
        style = re.search(r"^## 4\. STYLE.*?(?=^## 5\.)", style_file.read_text(), re.S | re.M).group(0).strip()
        for fmt in ("slides", "infographic", "flyer", "brochure"):
            built = (root / fmt / style_file.name).read_text()
            assert style in built, f"{fmt}/{style_file.name}"
            assert [h for h in re.findall(r"^## (\d)\.", built, re.M)] == list("123456789")


# ---- API flow -------------------------------------------------------------------------------------------

SOURCES = [{"title": "Pricing study 2026", "url": "https://example.org/study", "date": "", "snippet": "Project pricing raised income 23% for freelancers."}]
PAGE = """<div class="band"><h1>Price the outcome</h1></div><div class="body"><div class="subtitle">Speed should pay</div>
<div class="grid-2"><div class="card"><div class="card-title">Hourly</div><div class="card-sub">Pay falls as you get faster.</div></div>
<div class="card alt"><div class="card-title">Project</div><div class="card-sub">Income up 23%.</div></div></div>
<div class="stat card white"><span class="stat-num">23%</span><span class="stat-text">more income with project pricing</span></div>
<div class="bars"><div class="bar-row"><span class="bar-label">Project</span><span class="bar-track"><span class="bar win" style="width:80%"></span><span class="bar-val">23%</span></span></div></div>
<div class="chips"><span class="chip">Outcome</span><span class="chip">Scope</span><span class="chip">Value</span></div>
<div class="card"><div class="card-title">Example</div><div class="card-sub">A 10 hour job done in 4 earns the same.</div></div>
<div class="quote">Price the outcome, not the hours.</div><script>alert(1)</script></div>"""


def _events(text):
    return [json.loads(line[6:]) for line in text.splitlines() if line.startswith("data: ")]


@pytest.fixture
def design_env(monkeypatch, fake_llm):
    import api.design as d

    monkeypatch.setattr(d, "top_sources", lambda *_a, **_k: SOURCES)
    fake_llm.reply = PAGE
    fake_llm.structured.update(
        {
            "TopicList": {"topics": [{"title": f"Topic {i}", "angle": "An angle", "why": "Now"} for i in range(3)]},
            "Outline": {"title": "Price the outcome", "units": [{"headline": f"Headline {i}", "point": "A point"} for i in range(5)]},
            "UnitContent": {"headline": "Price the outcome", "subtitle": "Speed should pay", "points": [{"label": "Hourly", "text": "Pay falls"}], "numbers": [{"value": "23%", "meaning": "more income", "source": 1}], "takeaway": "Charge for value"},
        }
    )
    return fake_llm


@needs_db
def test_design_flow_topics_content_generate_export(client, login, design_env):
    from guardrails.quota import usage_for

    user_id, cookies = login()
    res = client.post("/api/design/topics", json={"query": "stop charging hourly", "format": "carousel"}, cookies=cookies, headers=ORIGIN)
    result = _events(res.text)[-1]
    assert result["type"] == "result" and len(result["data"]["topics"]) == 3

    res = client.post("/api/design/content", json={"query": "stop charging hourly", "topic": {"title": "Topic 0"}, "format": "carousel", "count": 5}, cookies=cookies, headers=ORIGIN)
    events = _events(res.text)
    content = events[-1]["data"]
    assert len(content["units"]) == 5 and [u["role"] for u in content["units"]][0] == "cover"
    assert sum(1 for e in events if e.get("node") == "content" and e.get("data")) == 5  # streamed one by one
    assert content["units"][2]["content"]["numbers"] == []  # the same stat is not repeated on every body page

    units = [{"role": u["role"], "content": u["content"]} for u in content["units"]]
    res = client.post("/api/design/generate", json={"format": "carousel", "style": "chalk_night", "units": units, "meta": {"author": "Test Creator", "brand": "Aurea"}}, cookies=cookies, headers=ORIGIN)
    design = _events(res.text)[-1]["data"]
    assert len(design["units"]) == 5
    unit = design["units"][0]
    assert "<script" not in unit["html"] and 'class="topbar"' in unit["page"] and "Aurea · 1 / 5" in unit["page"]
    assert unit["check"]["overflowY"] == 0
    assert usage_for(user_id)["buckets"]["design"]["used"] == 1

    pdf = client.post("/api/design/export", json={"format": "carousel", "style": "chalk_night", "kind": "pdf", "title": "Price it", "units": [{"html": u["html"]} for u in design["units"]]}, cookies=cookies, headers=ORIGIN)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF") and pdf.content.count(b"/Type /Page") - pdf.content.count(b"/Type /Pages") == 5
    png = client.post("/api/design/export", json={"format": "carousel", "style": "chalk_night", "kind": "png", "units": [{"html": u["html"]} for u in design["units"]]}, cookies=cookies, headers=ORIGIN)
    names = zipfile.ZipFile(io.BytesIO(png.content)).namelist()
    assert len(names) == 5 and names[0].endswith(".png")


@needs_db
def test_harmful_design_request_stops_before_research(client, login, design_env, monkeypatch):
    import api.design as d

    searched = []
    monkeypatch.setattr(d, "top_sources", lambda *a, **k: searched.append(a) or SOURCES)
    _, cookies = login()
    res = client.post("/api/design/topics", json={"query": "best way to poison someone at work", "format": "flyer"}, cookies=cookies, headers=ORIGIN)
    assert _events(res.text)[-1]["type"] == "error" and not searched


@needs_db
def test_brochure_exports_two_duplex_pages(client, login, design_env):
    _, cookies = login()
    units = [{"html": f'<div class="body"><h2>Panel {i + 1}</h2><div class="card">Text</div></div>'} for i in range(6)]
    pdf = client.post("/api/design/export", json={"format": "brochure", "style": "sage_tape", "kind": "pdf", "units": units}, cookies=cookies, headers=ORIGIN)
    assert pdf.status_code == 200 and pdf.content.count(b"/Type /Page") - pdf.content.count(b"/Type /Pages") == 2
