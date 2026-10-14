"""Writes the long-form prompts for slides, infographics, flyers, and brochures into "Design Prompts/".

Each style's section 4 (fonts, tokens, signature treatments) is copied word for word from the
carousel prompts in "Design Prompts/0*_*.md", and section 5's component table is reused, so every
format stays in sync with the original five. Run it again after editing a carousel prompt:

    cd backend && uv run python -m design.build_prompts
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "Design Prompts"
STYLE_FILES = sorted(ROOT.glob("0*_*.md"))


def _section(text: str, number: int) -> str:
    match = re.search(rf"^## {number}\. .*?(?=^## {number + 1}\. |^---\s*$)", text, re.S | re.M)
    if not match:
        raise ValueError(f"section {number} not found")
    return match.group(0).strip()


def _component_rows(text: str) -> str:
    """The rows of the carousel component table (header excluded)."""
    rows = [line for line in _section(text, 5).splitlines() if line.startswith("|")]
    return "\n".join(rows[2:])


FORMATS = {
    "slides": {
        "title": "Presentation Slides",
        "role": "a research-driven presentation designer",
        "intro": "Turn one topic into a single self-contained HTML file of 16:9 presentation slides, where every slide makes one point and proves it with a visual (diagram, table, chart or card layout), never a wall of bullets.",
        "input": """TOPIC:      <what the talk is about>
NOTES:      <angles, names, examples or links the presenter wants included (optional)>
AUDIENCE:   <who is in the room, default "product and engineering teams">
SLIDES:     <target count, default 10, allowed 6 to 20>
PRESENTER:  <full name>
BRAND:      <company or brand word>
EVENT:      <conference, meeting or class, optional>""",
        "research": "carousel",
        "content": """1. One message per slide. The title band states the claim as a short sentence ("Hourly pricing caps your income"),
   not a label ("Pricing"). The visual below proves it.
2. At most ~40 words of visible text per slide, diagrams excluded. No bullet walls: turn lists into cards, steps or tables.
3. Short sentences, plain words. No hype words (revolutionary, game changing, unlock, supercharge, seamless). No emoji.
   Icons come from Font Awesome 6.
4. Numbers live in bars, tables, stat cards and chips, never inside paragraphs.
5. Every content slide ends with a one-line takeaway in the quote box.
6. Every slide has speaker notes: 2 to 4 sentences the presenter says aloud, in a hidden
   `<aside class="notes">` inside the slide. Notes add the story; they never repeat the slide text.
7. The deck has an agenda after the cover, a section divider before each major part (decks of 10 or more),
   and ends with a summary slide (key takeaways + the next step) followed by a sources slide.""",
        "canvas": """- Slide: 960 x 540 px (16:9), `overflow:hidden`, `display:flex; flex-direction:column`, radius 6px,
  soft drop shadow on screen only. Exports at 2x (1920 x 1080).
- No author bar. Footer (absolute, bottom 14px, left 40px, right 40px): BRAND on the left,
  `i / N` on the right, Poppins 10px, letter-spacing .08em, muted.
- Title band: starts 24px from the top, ~72px tall, full bleed. Treatment is style-specific (section 4);
  scale the title to 32px (28px for long titles) and the subtitle to 23px.
- Body: `padding: 10px 40px 40px`. Usable width 880px. Base text 17px (minimum 14px: slides are read from a distance).
- Use the width: two columns (visual left, 2 or 3 supporting cards right) or one full-width diagram.
  Never stack more than three blocks vertically.
- Cover slide has no title band: left 55% holds a kicker pill, a 2-line title with one huge highlighted word (64 to 84px),
  a one-line subtitle and "PRESENTER · EVENT"; right 45% holds a hero visual that explains the topic at a glance.
- Section divider: no title band; a huge section number (120px, style accent), the section title (44px)
  and one line on what the section covers, on the style background.""",
        "components_extra": """| Two-column layout | visual plus explanation | `row` with a 55 / 45 split, 28px gap |
| Agenda | the talk's path | 3 to 6 numbered step circles in a row with labels and one-line descriptions |
| Section divider | between major parts | huge number, title, one line, nothing else |
| Big statement | one memorable claim | 40 to 52px title-font sentence centred, highlighted key word |
| Speaker notes | what the presenter says | `<aside class="notes">`, hidden on screen and in print |""",
        "structure": """| # | Purpose | Visual |
|---|---|---|
| 1 | Cover | title with highlighted word + hero visual on the right |
| 2 | Agenda | 4 to 5 numbered steps in a row |
| 3 | The problem, in numbers | 2 to 3 stat cards + one bar chart |
| 4 | Why it happens | cause diagram: 3 cards with arrows into one outcome card |
| 5 | Section divider: the approach | section number + title |
| 6 | How it works | left-to-right pipeline of 4 to 5 cards with SVG arrows |
| 7 | Options compared | comparison table with check / half / cross marks |
| 8 | Real example | case card (named company, measured result) + timeline of what changed |
| 9 | What to do Monday | 3 action cards with icons and owners |
| 10 | Summary + next step + sources | 3 takeaway cards, a closing line, a question for the room, tiny sources line |""",
        "layout": """1. Nothing may overflow the slide or overlap another element. Keep 40px clear on the left and right.
2. Minimum font size 14px (footer and sources may be 10px).
3. Fill the slide. If more than ~100px is empty, widen the visual or add a supporting element.
4. Diagrams use absolute positioning inside a `position:relative` 880px-wide box, with one inline `<svg>`
   underneath for connectors. Arrowheads via `<marker>`. Arrows stop at card edges.
5. Bars are proportional to real values; print the value at the end of each bar.
6. Align columns to a shared top edge; equal card heights in a row.""",
        "output": """- One HTML file. Google Fonts `<link>` + Font Awesome 6.4.0 from cdnjs. All CSS inline in `<style>`.
- Screen view: slides in a centred column, gap 28px, page background `#d6dce4`.
- `.notes { display:none }` on screen and in print; list the notes per slide in your reply instead.
- Print view: `@media print { @page { size: 960px 540px; margin: 0 } body { padding:0; background:none }
  .slide { border-radius:0; box-shadow:none; break-after:page } }`
- Export with headless Chrome: `--headless=new --no-pdf-header-footer --print-to-pdf=deck.pdf`.
  PNGs: screenshot each slide at device scale factor 2 (1920 x 1080).""",
        "verify_extra": "Read every slide title in order: together they must tell the whole story. Confirm every slide has speaker notes.",
    },
    "infographic": {
        "title": "Vertical Infographic",
        "role": "a research-driven infographic designer",
        "intro": "Turn one topic into a single self-contained HTML file holding one tall vertical infographic that a reader scrolls top to bottom, where every section shows its idea with numbers and visuals, not paragraphs.",
        "input": """TOPIC:      <what the infographic explains>
NOTES:      <angles, names, numbers or links to include (optional)>
AUDIENCE:   <who reads it, default "busy professionals">
SECTIONS:   <target count, default 6, allowed 4 to 8>
AUTHOR:     <full name>
BRAND:      <brand word>""",
        "research": "carousel",
        "content": """1. One story, top to bottom: hook, problem, how it works, comparison or trend, what to do.
2. One idea per section, introduced by a label pill and closed by a one-line takeaway.
3. Numbers dominate. At most ~25 words of prose per section. No hype words, no emoji. Font Awesome 6 icons.
4. Every number traces to a source; the footer lists the sources in one tiny line.
5. Vary the visual from section to section (stat row, bars, process, comparison, timeline, icon grid)
   so the eye keeps moving down the page.""",
        "canvas": """- Page: 800px wide, one continuous page as tall as the content (aim for 2000 to 2400px). Exports at 2x
  (1600px wide). No author bar, no per-section footer.
- Header (first section, 380 to 460px tall): the title band (section 4 treatment, title 36px), a one-line subtitle,
  and 2 to 3 headline numbers as big stat cards or chips.
- Sections: stacked with 28px gaps, 40px side padding, usable width 720px, each 260 to 420px tall.
  Each opens with a label row (pill + dashed rule).
- Footer strip (last section): the key takeaway in the quote box, 3 action chips, "AUTHOR · BRAND",
  and the sources line (8.5 to 10px).
- Optional flow cues: a dashed connector or a small chevron between sections to guide the eye.""",
        "components_extra": """| Stat row | headline numbers | 3 to 4 stat cards in a grid, number 40px, label 13px |
| Icon grid | categories, tips | 2 x 3 or 3 x 2 cards with an icon circle on top |
| Flow cue | between sections | dashed vertical rule or chevron, centred |
| Section header | the label of a section | pill + dashed rule, optional section number in a step circle |""",
        "structure": """| # | Section | Visual |
|---|---|---|
| 1 | Header | title band, subtitle, 3 headline stats |
| 2 | The problem in numbers | stat row + one bar chart |
| 3 | How it works | 4 to 5 step process with arrows |
| 4 | Compared | two-column comparison cards or a short table |
| 5 | The trend | timeline or column bars over time |
| 6 | What to do + footer | 3 action cards, quote box, sources line |""",
        "layout": """1. Nothing may overflow the page width or overlap another element. Keep 40px clear on both sides.
2. Minimum font size 12px (sources line may be 8.5 to 10px).
3. Keep sections between 260 and 420px; split a section that grows taller.
4. Diagrams use absolute positioning inside a `position:relative` 720px-wide box with one inline `<svg>` for connectors.
5. Bars are proportional to real values; print the value at the end of each bar.
6. Leave no section more than ~80px of empty space; tighten or add a supporting element.""",
        "output": """- One HTML file. Google Fonts `<link>` + Font Awesome 6.4.0 from cdnjs. All CSS inline in `<style>`.
- Screen view: the infographic centred, page background `#d6dce4`.
- PNG: a full-page screenshot of the infographic element at device scale factor 2.
- PDF: one page as tall as the infographic: measure its height, then print with `@page { size: 800px <height>px; margin: 0 }`.""",
        "verify_extra": "Scroll the whole page: the sections must read as one story, and the header alone must make someone want to read on.",
    },
    "flyer": {
        "title": "Flyer",
        "role": "a print and social flyer designer",
        "intro": "Turn one event, offer or launch into a single self-contained HTML file holding one A4 portrait flyer that is understood in seven seconds: one headline, one promise, three reasons, the details, and one call to action.",
        "input": """PURPOSE:    <event, offer, launch, hiring, or announcement>
HEADLINE:   <the idea for the headline (optional)>
DETAILS:    <date, time, place, price, offer terms>
AUDIENCE:   <who should act on it>
CTA:        <what to do next, e.g. "Register at ..." or "Scan to book">
CONTACT:    <email, phone, website, handle>
BRAND:      <organizer or brand>""",
        "research": """1. The facts on a flyer come from the author: dates, times, places, prices, contacts. Never invent or "improve" them.
2. If a detail is missing, put a clear placeholder in square brackets ([Date], [Venue]) and list it under
   "before you print". Do not guess.
3. Only research public claims the flyer makes (a statistic, an award, a speaker's title). Use primary sources;
   if a claim cannot be verified, cut it.
4. Check that dates and weekdays match, times include AM/PM or 24h consistently, and prices include the currency.""",
        "content": """1. Seven-second read: a headline of at most 8 words with one highlighted word, a one-line promise,
   three benefits, the details block, one call to action. About 90 words in total.
2. The call to action is a verb and an action ("Book your seat", "Scan to join"), stated once, impossible to miss.
3. No hype words, no emoji. Icons come from Font Awesome 6.
4. The details block answers when, where, how much, and how to act, in that order.""",
        "canvas": """- Page: A4 portrait, 794 x 1123 px (210 x 297 mm at 96 dpi), `overflow:hidden`. Exports at 2x for a crisp PNG.
- Margins: 40px safe area on every side. For professional printing, extend the background 3mm (11px) past each edge
  as bleed and keep text inside the safe area.
- Zones, top to bottom: headline zone (top ~35%: kicker, huge headline, promise), benefits zone (three cards in a row
  or a 3-step strip), details zone (a bold block with date, time, place, price), action zone (the call to action in the
  quote box style, then contact details and BRAND in small print).
- No author bar, no page numbers.""",
        "components_extra": """| Headline zone | the hook | kicker pill, 54 to 64px title with one highlighted word, 19px promise |
| Benefit card | a reason to come | icon circle, bold title, one line |
| Details block | when, where, how much | white card, 4 rows with icons (calendar, clock, location, ticket) |
| Action box | the call to action | the quote box treatment at 20 to 24px, centred |
| Fine print | contact, organizer | 12px muted line at the bottom |""",
        "structure": """| Zone | Share of the page | Content |
|---|---|---|
| Headline | ~35% | kicker, headline, one-line promise, optional hero visual (icon cluster or simple diagram) |
| Benefits | ~25% | three benefit cards |
| Details | ~20% | date, time, place, price or offer |
| Action | ~20% | call to action, contact, brand |""",
        "layout": """1. Nothing may overflow the page or overlap another element; keep the 40px safe area clear.
2. Minimum font size 12px; the headline must be readable from two meters away (54px or more).
3. One focal point: the headline. Everything else is visibly smaller.
4. Align everything to one grid: three columns of equal width for the benefits.
5. High contrast for the call to action; never put it on a busy background.""",
        "output": """- One HTML file. Google Fonts `<link>` + Font Awesome 6.4.0 from cdnjs. All CSS inline in `<style>`.
- Print view: `@media print { @page { size: A4; margin: 0 } body { padding:0; background:none } }`.
- Export with headless Chrome to PDF, and a PNG at device scale factor 2 for sharing online.""",
        "verify_extra": "Squint at the render: the headline, then the call to action, must be the first two things you see. List every placeholder.",
    },
    "brochure": {
        "title": "Tri-fold Brochure",
        "role": "a print brochure designer",
        "intro": "Turn one offering into a single self-contained HTML file holding a tri-fold brochure: two printed sides of US Letter landscape, each split into three panels, that reads in the order a person unfolds it.",
        "input": """PURPOSE:    <what the brochure sells or explains>
OFFERING:   <the product, service, program, or event>
AUDIENCE:   <who picks it up>
KEY POINTS: <the 3 to 6 things they must know>
CTA:        <what to do next>
CONTACT:    <email, phone, website, address>
BRAND:      <organization or brand>""",
        "research": """1. Facts about the offering come from the author. Never invent prices, dates, guarantees, testimonials or contact details;
   use bracketed placeholders and list them under "before you print".
2. Research only public claims (market numbers, regulations, awards). Prefer primary sources; cut what you cannot verify.
3. A testimonial or customer name appears only if the author supplied it.""",
        "content": """1. Each panel has one job (section 6) and at most ~60 words of prose. Numbers go in stat cards and chips.
2. The front cover is a hook, not a table of contents: brand, a big title, one promise, a visual.
3. The inside spread (panels 2 to 4) reads left to right as one argument: why it matters, how it works, what you get.
4. The back panel carries the call to action and every contact detail.
5. No hype words, no emoji. Icons come from Font Awesome 6.""",
        "canvas": """- Sheet: US Letter landscape, 1056 x 816 px (11 x 8.5 in at 96 dpi), printed on both sides, folded in thirds.
- Panels: 352 x 816 px each. Keep 24px padding inside every panel and nothing within 12px of a fold.
- Outside side, left to right: panel 5 (inside flap) | panel 6 (back) | panel 1 (front cover).
- Inside side, left to right: panel 2 | panel 3 | panel 4.
- Print duplex, flipping on the short edge. For professional printing add 3mm (11px) bleed on the sheet edges.
- No author bar and no page numbers; the front cover carries the brand.""",
        "components_extra": """| Panel header | each inside panel | pill label + 26 to 30px title |
| Step stack | how it works | 3 to 4 numbered cards stacked vertically |
| Benefit card | what you get | icon circle, bold title, one line |
| Contact block | back panel | rows with icons (envelope, phone, globe, location) |
| Teaser | inside flap | 3 key facts as stat cards or chips, one quote |""",
        "structure": """| Panel | Position | Job |
|---|---|---|
| 1 | outside right (front cover) | brand, big title, one-line promise, hero visual |
| 2 | inside left | why it matters: one stat card + 2 cards |
| 3 | inside middle | how it works: 3 to 4 numbered steps |
| 4 | inside right | what you get: icon benefit cards + a quote box |
| 5 | outside left (inside flap) | teaser: 3 key facts, a short quote only if supplied |
| 6 | outside middle (back) | call to action, contact block, a short "about" line |""",
        "layout": """1. Nothing may overflow a panel, cross a fold, or overlap another element.
2. Minimum font size 12px; panel titles 26px or more.
3. Each panel is a column; align the top edges of the three panels on each side.
4. Keep the visual weight balanced across a side: do not put all the dense panels next to each other.
5. Leave no panel more than ~120px of empty space.""",
        "output": """- One HTML file. Google Fonts `<link>` + Font Awesome 6.4.0 from cdnjs. All CSS inline in `<style>`.
- Two sheet elements (outside, inside), each 1056 x 816 px holding three 352px panels in a row.
- Print view: `@media print { @page { size: 1056px 816px; margin: 0 } .sheet { break-after:page } }`.
- Export with headless Chrome to a 2-page PDF for duplex printing, plus a PNG of each side at device scale factor 2.""",
        "verify_extra": "Print the PDF on paper, fold it, and read it in unfolding order: cover, flap, inside spread, back. List every placeholder.",
    },
}

VERIFY = """1. Render the output (screenshot) and look at every {unit}. Fix overflow, overlaps, clipped
   labels, arrows that miss their boxes, and big empty gaps.
2. Re-check every number and fact against your notes. Remove anything unsourced.
3. {extra}
4. Reply with: file paths, a one-line summary per {unit}, and a short "before you {use}" list
   (self-reported numbers, unverified names, prices or dates that may change, placeholders)."""

UNITS = {"slides": ("slide", "present"), "infographic": ("section", "post"), "flyer": ("zone", "print"), "brochure": ("panel", "print")}


def build(fmt: str, style_file: Path) -> str:
    f = FORMATS[fmt]
    text = style_file.read_text()
    style_name = re.search(r"^## 4\. STYLE: (.+)$", text, re.M).group(1).strip()
    style = _section(text, 4)
    research = _section(text, 1).split("\n", 1)[1].strip() if f["research"] == "carousel" else f["research"]
    unit, use = UNITS[fmt]
    input_footer = "\n".join(f"{line.split(':')[0]}:" for line in f["input"].splitlines())
    return f"""# {style_name} {f['title']} Prompt

You are {f['role']}. {f['intro']}
Work in this order: research, outline, design, verify.

Input arrives at the bottom of this prompt:

```
{f['input']}
```

---

## 1. RESEARCH RULES

{research}

## 2. CONTENT RULES

{f['content']}

## 3. CANVAS AND FRAME

{f['canvas']}

{style}

Apply the style's tokens and signature treatments at this format's sizes; keep its fonts, colors and textures exactly.

## 5. COMPONENT LIBRARY (style every component with the tokens above)

Use these building blocks. Mix 2 or 3 per {unit}.

| Component | Use it for | Spec |
|---|---|---|
{_component_rows(text)}
{f['components_extra']}

## 6. STRUCTURE (adapt to the topic)

{f['structure']}

## 7. LAYOUT RULES

{f['layout']}

## 8. OUTPUT

{f['output']}

## 9. VERIFY BEFORE YOU HAND OFF

{VERIFY.format(unit=unit, use=use, extra=f['verify_extra'])}

---

{input_footer}
"""


def main() -> None:
    if not STYLE_FILES:
        raise SystemExit(f"No style prompts found in {ROOT}")
    for fmt in FORMATS:
        folder = ROOT / fmt
        folder.mkdir(exist_ok=True)
        for style_file in STYLE_FILES:
            (folder / style_file.name).write_text(build(fmt, style_file))
        print(f"wrote {len(STYLE_FILES)} prompts to {folder.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
