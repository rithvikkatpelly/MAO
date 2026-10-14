"""Runtime prompts for the design studio: topics, outline, content per unit, and HTML per unit.

The long-form prompts for each format and style live in "Design Prompts/" (written by
design/build_prompts.py). At runtime the local model gets the same rules in a compact form, one
unit at a time, with one example page in the same class system.
"""

import json

from design.formats import FORMATS, role_guide, unit_label
from design.styles import CLASS_REFERENCE, STYLES
from guardrails.untrusted import fence
from text_rules import STYLE_RULE

WRITING_RULES = (
    "One idea per page. Short sentences, plain words, technical but friendly. "
    "No hype words (revolutionary, game changing, unlock, supercharge, seamless) and no emoji. "
    "Numbers belong in stat cards, bars, tables, and chips, not inside paragraphs. "
    "Every number must come from the research; never invent product names, customers, quotes, or scores. "
    "Real, named examples beat hypotheticals."
)

# One well-filled example per format, in the shared class system (different topic each time).
EXAMPLES = {
    "carousel": """<div class="band"><h1>Rules engines vs LLMs</h1></div>
<div class="body">
  <div class="subtitle">Same question, two very different machines</div>
  <div class="grid-2">
    <div class="card"><div class="card-title"><span class="icon sm"><i class="fa-solid fa-list-check"></i></span>Rules engine</div>
      <div class="card-sub">Fixed if-then logic written by people. Same input, same answer.</div>
      <div class="chips" style="justify-content:flex-start"><span class="chip">Under 5 ms</span><span class="chip">Auditable</span></div></div>
    <div class="card alt"><div class="card-title"><span class="icon sm"><i class="fa-solid fa-brain"></i></span>LLM</div>
      <div class="card-sub">Predicts text from patterns in data. Flexible, but can be wrong.</div>
      <div class="chips" style="justify-content:flex-start"><span class="chip">1 to 3 s</span><span class="chip">Handles ambiguity</span></div></div>
  </div>
  <div class="label-row"><span class="pill">Where each wins</span></div>
  <div class="bars">
    <div class="bar-row"><span class="bar-label">Rules: speed</span><span class="bar-track"><span class="bar win" style="width:92%"></span><span class="bar-val">5 ms</span></span></div>
    <div class="bar-row"><span class="bar-label">LLM: speed</span><span class="bar-track"><span class="bar" style="width:18%"></span><span class="bar-val">2 s</span></span></div>
  </div>
  <div class="stat card white"><span class="stat-num">40x</span><span class="stat-text">faster for fixed decisions like fraud flags and tax rules.</span></div>
  <div class="quote">Use rules when the answer must never change.</div>
</div>""",
    "slides": """<div class="band"><h1>Why onboarding stalls in week two</h1></div>
<div class="body">
  <div class="subtitle">Most drop-off happens after setup, not during it</div>
  <div class="row">
    <div class="col">
      <div class="label-row"><span class="pill">Where users leave</span></div>
      <div class="bars">
        <div class="bar-row"><span class="bar-label">Sign-up</span><span class="bar-track"><span class="bar" style="width:100%"></span><span class="bar-val">100%</span></span></div>
        <div class="bar-row"><span class="bar-label">Setup done</span><span class="bar-track"><span class="bar" style="width:71%"></span><span class="bar-val">71%</span></span></div>
        <div class="bar-row"><span class="bar-label">Active in week 2</span><span class="bar-track"><span class="bar win" style="width:38%"></span><span class="bar-val">38%</span></span></div>
      </div>
    </div>
    <div class="col">
      <div class="card"><div class="card-title"><span class="icon sm"><i class="fa-solid fa-hourglass-half"></i></span>No first win</div><div class="card-sub">Users finish setup but never see a result they care about.</div></div>
      <div class="card alt"><div class="card-title"><span class="icon sm"><i class="fa-solid fa-bell-slash"></i></span>Silence after day 3</div><div class="card-sub">No nudge, no check-in, so the habit never forms.</div></div>
    </div>
  </div>
  <div class="quote">Design week two, not just day one.</div>
</div>""",
    "infographic": """<div class="body" style="gap:14px">
  <div class="label-row"><span class="pill"><i class="fa-solid fa-chart-simple"></i> How remote teams spend a week</span></div>
  <div class="grid-4">
    <div class="card center"><span class="big">12h</span><span class="small">in meetings</span></div>
    <div class="card alt center"><span class="big">9h</span><span class="small">on chat</span></div>
    <div class="card center"><span class="big">16h</span><span class="small">deep work</span></div>
    <div class="card alt center"><span class="big">3h</span><span class="small">learning</span></div>
  </div>
  <div class="row" style="align-items:center">
    <span class="icon lg"><i class="fa-solid fa-lightbulb"></i></span>
    <div class="lead" style="text-align:left">Deep work is under half the week. Protecting two meeting-free mornings moves it past 20 hours.</div>
  </div>
</div>""",
    "flyer": """<div class="cover" style="padding:44px 40px 36px;gap:18px">
  <span class="kicker">Free workshop · June 14</span>
  <h1 style="font-size:58px">Price your work <span class="huge hl">better</span></h1>
  <div class="lead" style="text-align:left;font-size:19px">A 90 minute hands-on session for freelancers who want to stop undercharging.</div>
  <div class="grid-3">
    <div class="card"><div class="card-title"><span class="icon sm"><i class="fa-solid fa-calculator"></i></span>Find your rate</div><div class="card-sub">Work out the number that covers costs, taxes, and time off.</div></div>
    <div class="card alt"><div class="card-title"><span class="icon sm"><i class="fa-solid fa-box"></i></span>Package it</div><div class="card-sub">Turn hourly work into three clear project packages.</div></div>
    <div class="card"><div class="card-title"><span class="icon sm"><i class="fa-solid fa-comments"></i></span>Say it out loud</div><div class="card-sub">Practice the price conversation with real scripts.</div></div>
  </div>
  <div class="card white" style="flex-direction:row;gap:24px;align-items:center">
    <span class="step">1</span><div><div class="card-title">Saturday, June 14 · 10:00</div><div class="card-sub">Riverside Library, Room B · 30 seats</div></div>
  </div>
  <div class="quote" style="font-size:20px">Reserve your seat: reply to this post or email the organizer.</div>
  <div class="small" style="text-align:center">Organized by the Freelance Collective</div>
</div>""",
    "brochure": """<div class="body" style="padding:28px 24px;gap:14px">
  <span class="pill">How it works</span>
  <h2 style="font-size:28px">Three steps to your first launch</h2>
  <div class="card"><div class="row" style="align-items:center"><span class="step">1</span><div class="card-title">Book a call</div></div><div class="card-sub">A 20 minute call to map your goals and timeline.</div></div>
  <div class="card alt"><div class="row" style="align-items:center"><span class="step">2</span><div class="card-title">Get a plan</div></div><div class="card-sub">A written plan with scope, price, and dates within 3 days.</div></div>
  <div class="card"><div class="row" style="align-items:center"><span class="step">3</span><div class="card-title">Launch</div></div><div class="card-sub">Weekly check-ins until your project goes live.</div></div>
  <div class="divider"></div>
  <div class="stat"><span class="stat-num">6 wk</span><span class="stat-text">from first call to launch on average</span></div>
  <div class="quote">Clear steps, no surprises.</div>
</div>""",
}


def topics_prompt(query: str, fmt: str, sources_text: str, audience: str) -> str:
    label = FORMATS[fmt]["label"].lower()
    return (
        f"A creator wants to make a {label}. Their request: {query}\n"
        + (f"Audience: {audience}\n" if audience else "")
        + f"\nCurrent sources:\n{sources_text}\n\n"
        f"Suggest 5 distinct topics for this {label}, each a specific angle grounded in the sources. "
        "Each has a short title (under 10 words), the angle in one sentence, and why it is worth making now. "
        "Do not cite source numbers.\n" + STYLE_RULE
    )


def outline_prompt(fmt: str, topic: dict, roles: list[str], facts: str, audience: str, notes: str) -> str:
    f = FORMATS[fmt]
    plan = "\n".join(f"{i + 1}. {r}: {role_guide(fmt, r, i)}" for i, r in enumerate(roles))
    return (
        f"Plan a {f['label'].lower()} ({f['description']}).\n"
        f"Topic: {topic['title']}: {topic.get('angle', '')}\n"
        + (f"Audience: {audience}\n" if audience else "")
        + (f"Creator's notes: {fence('notes', notes)}\n" if notes else "")
        + f"\nResearch:\n{fence('research', facts)}\n\n"
        f"Write exactly {len(roles)} {f['unit']}s in this order, one per line of the plan:\n{plan}\n\n"
        f"For each {f['unit']}: a headline (under 9 words) and the one point it makes (one sentence). "
        f"The headlines must tell a story in order and never repeat. Give the whole piece a short title.\n"
        "Stay on the topic. Use a source only where it supports the topic, and skip sources about something else.\n"
        + WRITING_RULES + "\n" + STYLE_RULE
    )


def content_prompt(fmt: str, topic: dict, outline: list[dict], index: int, role: str, facts: str, audience: str, notes: str, used_numbers: list[str] | None = None) -> str:
    f = FORMATS[fmt]
    story = "\n".join(f"{i + 1}. {u['headline']}" for i, u in enumerate(outline))
    unit = outline[index]
    extra = ""
    if fmt == "slides":
        extra = "Also write speaker notes: 2 to 4 sentences the presenter says aloud. "
    if fmt in ("flyer", "brochure") or role in ("closing", "back"):
        extra += "Include a call to action (cta). "
    if fmt == "flyer":
        extra += "List the key details (date, time, place, price, offer, contact) only if the request or research gives them. "
    return (
        f"Write the content for {unit_label(fmt, index, len(outline))} of a {f['label'].lower()}.\n"
        f"Topic: {topic['title']}: {topic.get('angle', '')}\n"
        + (f"Audience: {audience}\n" if audience else "")
        + (f"Creator's notes: {fence('notes', notes)}\n" if notes else "")
        + f"The whole piece, in order:\n{story}\n\n"
        f"This {f['unit']}: {unit['headline']}. Point: {unit['point']}\n"
        f"Its job: {role_guide(fmt, role, index)}\n\n"
        f"Research:\n{fence('research', facts)}\n\n"
        + (f"Numbers already used on earlier pages, do not repeat them: {', '.join(used_numbers)}. If no other number fits, use none.\n" if used_numbers else "")
        + "Stay on this page's point; ignore research about something else.\n"
        "Write: the headline, a subtitle that states the point, 2 to 5 key points (a 1 to 4 word label and one short sentence each), "
        "the numbers worth showing (value, what it measures, and the source number), one sentence on the best visual "
        "(comparison cards, steps, table, bars, timeline, stat cards, icon grid), and a one-line takeaway. "
        + extra
        + WRITING_RULES
        + "\n"
        + STYLE_RULE
    )


COVER_EXAMPLE = """<div class="cover">
  <span class="kicker">LLMs vs decision models</span>
  <h1>Which brain runs your <span class="huge hl">product?</span></h1>
  <div class="lead" style="text-align:left">Two ways to make software decide, and when each one wins.</div>
  <div class="grid-2">
    <div class="card"><div class="card-title"><span class="icon sm"><i class="fa-solid fa-brain"></i></span>LLM</div><div class="card-sub">Flexible, reads language, can be wrong.</div></div>
    <div class="card alt"><div class="card-title"><span class="icon sm"><i class="fa-solid fa-diagram-project"></i></span>Decision model</div><div class="card-sub">Fixed logic, fast, auditable.</div></div>
  </div>
  <div class="chips"><span class="chip">Speed</span><span class="chip">Cost</span><span class="chip">Where each wins</span></div>
  <div class="spacer"></div>
  <div class="row" style="align-items:flex-end"><div class="byline">By<b>Author Name</b>Brand</div><span class="spacer"></span><span class="swipe">Swipe &gt;&gt;&gt;</span></div>
</div>"""


def content_text(content: dict) -> str:
    """A unit's content as plain lines for the HTML prompt."""
    lines = [f"Headline: {content.get('headline', '')}"]
    if content.get("subtitle"):
        lines.append(f"Subtitle: {content['subtitle']}")
    for p in content.get("points", []):
        lines.append(f"- {p.get('label', '')}: {p.get('text', '')}")
    for n in content.get("numbers", []):
        lines.append(f"Number: {n.get('value', '')} ({n.get('meaning', '')})")
    for d in content.get("details", []):
        lines.append(f"Detail: {d}")
    if content.get("visual"):
        lines.append(f"Visual idea: {content['visual']}")
    if content.get("takeaway"):
        lines.append(f"Takeaway: {content['takeaway']}")
    if content.get("cta"):
        lines.append(f"Call to action: {content['cta']}")
    return "\n".join(lines)


def html_prompt(fmt: str, style: str, index: int, total: int, role: str, content: dict, meta: dict, design_ideas: str, feedback: str = "", instruction: str = "", current_html: str = "") -> str:
    f = FORMATS[fmt]
    s = STYLES[style]
    size = f"{f['width']} x {f['height']} px" if f["height"] else f"{f['width']} px wide, {f['section_height']}"
    frame_note = {
        "carousel": "The frame (author bar at the top, page number at the bottom) is added for you.",
        "slides": "A small footer with the brand and slide number is added for you.",
    }.get(fmt, "There is no frame; you design the whole area.")
    band_rule = {
        "carousel": "Start with the title band, then ONE <div class=\"body\">. A cover uses <div class=\"cover\"> instead and no band.",
        "slides": "Start with the title band, then ONE <div class=\"body\">. A cover or section slide uses <div class=\"cover\"> and no band. Use the width: 2 or 3 columns with row and col.",
        "infographic": "This is one section of a tall infographic. Use ONE <div class=\"body\">. Only the header section uses the title band; other sections open with a label-row.",
        "flyer": "Use ONE <div class=\"cover\"> filling the page, top to bottom.",
        "brochure": "Use ONE <div class=\"body\"> with 24 px side padding. Only the front cover may use the title band or a large h1.",
    }[fmt]
    author = meta.get("author", "")
    brand = meta.get("brand", "")
    parts = [
        f"You design {unit_label(fmt, index, total)} of a {f['label'].lower()} as HTML. The canvas is {size}. {frame_note}",
        f"Style: {s['name']}. {s['mood']}",
        f"A stylesheet is loaded. Use these class names:\n{CLASS_REFERENCE}",
        "Rules:\n- " + "\n- ".join([
            band_rule,
            "Teach with visuals (cards, chips, bars, a table, steps, a timeline, stat cards, inline SVG diagrams). Never a wall of text.",
            "Use 3 or 4 different components so the area is full, and end body pages with a quote box holding the takeaway.",
            f"Space: {f['usable']}. Fill it without overflowing.",
            "Use every fact and number from the content. Invent nothing else, and never copy numbers or text from the example.",
            "Minimum font size 12px. Inline style only for sizes, gaps, spacing, and the occasional accent color.",
            "Icons: Font Awesome 6 solid, <i class=\"fa-solid fa-NAME\"></i>.",
            "No <html>, <head>, <style>, <script>, images, or links. Output only the HTML, nothing before or after it.",
        ]),
        f"What this {f['unit']} is for: {role_guide(fmt, role, index)}",
    ]
    if role == "cover" and fmt in ("carousel", "slides"):
        parts.append(f"This is the COVER. Use <div class=\"cover\"> and no title band. Byline: By {author}{' / ' + brand if brand else ''}.")
    if design_ideas:
        parts.append(f"The creator's design ideas (follow them within the style): {design_ideas}")
    example = COVER_EXAMPLE if role == "cover" and fmt in ("carousel", "slides") else EXAMPLES[fmt]
    parts.append(f"Example of a well-filled {'cover' if example is COVER_EXAMPLE else f['unit']} in this system (different topic):\n{example}")
    parts.append(f"Content for this {f['unit']}:\n{fence('content', content_text(content))}")
    if current_html:
        parts.append(f"The current HTML of this {f['unit']}:\n{fence('current_html', current_html[:3500])}")
    if instruction:
        parts.append(f"The creator asks for this change: {instruction}\nKeep everything they did not ask to change.")
    if feedback:
        parts.append(f"Your previous version had problems. Fix them: {feedback}")
    return "\n\n".join(parts)


def sources_line(sources: list[dict]) -> str:
    return json.dumps([s.get("title", "") for s in sources][:6])
