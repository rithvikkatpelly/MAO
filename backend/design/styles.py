"""The five design styles, from "Design Prompts/0*_*.md", as a CSS design system.

Each style is a set of tokens plus its signature treatments (title band, quote box, cards,
highlight). The shared component CSS below reads only CSS variables, so the model composes
any layout from the same class names in every style, and the style decides how it looks.
"""

import random

# ---- shared ---------------------------------------------------------------------------------


def _torn_edge(seed: int, points: int = 60, depth: float = 8.0) -> str:
    """A hand-torn top and bottom edge, the same every time for a given seed."""
    r = random.Random(seed)
    top = [(i * 100 / points, r.uniform(0, depth)) for i in range(points + 1)]
    bottom = [(100 - i * 100 / points, 100 - r.uniform(0, depth)) for i in range(points + 1)]
    return "polygon(" + ",".join(f"{x:.1f}% {y:.1f}%" for x, y in top + bottom) + ")"


FONT_AWESOME = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"

BASE_CSS = """
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:transparent}
.page{position:relative;width:var(--w);height:var(--h);overflow:hidden;display:flex;flex-direction:column;
 background-color:var(--bg);background-image:var(--pattern);background-size:var(--pattern-size);
 color:var(--ink);font-family:var(--body-font);font-size:var(--body-size);line-height:1.25}
.page.auto{height:auto;min-height:200px;overflow:visible}
.ui{font-family:'Poppins',sans-serif}
/* frame */
.topbar{position:absolute;top:12px;left:14px;right:16px;display:flex;align-items:center;gap:8px;z-index:3}
.avatar{width:30px;height:30px;border-radius:50%;background:var(--pill-bg);color:var(--pill-fg);display:flex;
 align-items:center;justify-content:center;font:600 11px 'Poppins',sans-serif;flex-shrink:0}
.author{font:500 11.5px 'Poppins',sans-serif;color:var(--muted)}
.chev{margin-left:auto;font:700 14px 'Poppins',sans-serif;color:var(--muted);letter-spacing:-2px}
.footer{position:absolute;bottom:9px;left:0;right:0;text-align:center;font:500 9.5px 'Poppins',sans-serif;
 letter-spacing:.08em;color:var(--muted);text-transform:uppercase;z-index:3}
.content{flex:1;display:flex;flex-direction:column;min-height:0}
.has-topbar .content{padding-top:44px}
.has-footer .content{padding-bottom:24px}
/* layout */
.body{flex:1;display:flex;flex-direction:column;gap:12px;padding:10px 26px 14px;min-height:0}
.row{display:flex;gap:12px;align-items:stretch}
.col{display:flex;flex-direction:column;gap:10px;flex:1;min-width:0}
.grid-2,.grid-3,.grid-4{display:grid;gap:12px}
.grid-2{grid-template-columns:repeat(2,1fr)}.grid-3{grid-template-columns:repeat(3,1fr)}.grid-4{grid-template-columns:repeat(4,1fr)}
.center{text-align:center;align-items:center;justify-content:center}
.spacer{flex:1}
.stack{position:relative}
/* text */
h1,h2,h3{font-family:var(--title-font);font-weight:var(--title-weight);line-height:1.08;color:var(--title-ink)}
.subtitle{font-family:var(--title-font);font-weight:var(--title-weight);font-size:21px;color:var(--ink-strong);
 text-align:center;align-self:center;padding-bottom:3px;line-height:1.15}
.lead{font-size:15px;text-align:center;color:var(--ink)}
.small{font-size:12.5px;color:var(--muted)}
.muted{color:var(--muted)}
.big{font-family:var(--title-font);font-weight:var(--title-weight);font-size:44px;line-height:1}
.hl{background:linear-gradient(transparent 52%,var(--hl) 52%,var(--hl) 80%,transparent 80%);padding:0 3px}
.kicker{display:inline-block;align-self:flex-start;font:600 12px 'Poppins',sans-serif;letter-spacing:.18em;
 text-transform:uppercase;padding:6px 12px}
/* blocks */
.card{background:var(--card-bg);border:var(--card-border);border-radius:var(--card-radius);box-shadow:var(--card-shadow);
 padding:12px 14px;display:flex;flex-direction:column;gap:5px;min-width:0}
.card.alt{background:var(--card-alt-bg)}
.card.white{background:var(--paper)}
.card-title{font-family:var(--title-font);font-weight:var(--title-weight);font-size:17px;color:var(--title-ink);
 display:flex;align-items:center;gap:8px;line-height:1.1}
.card-sub{font-size:12.5px;color:var(--ink);line-height:1.3}
.pill{display:inline-flex;align-items:center;gap:6px;background:var(--pill-bg);color:var(--pill-fg);border-radius:var(--pill-radius);
 padding:4px 12px;font-family:var(--pill-font);font-size:16px;align-self:flex-start;line-height:1.2}
.chips{display:flex;flex-wrap:wrap;gap:7px;justify-content:center}
.chip{display:inline-flex;align-items:center;gap:6px;background:var(--chip-bg);border:var(--chip-border);border-radius:var(--chip-radius);
 box-shadow:var(--chip-shadow);padding:4px 10px;font-size:13px;color:var(--ink)}
.icon{width:40px;height:40px;border-radius:50%;background:var(--icon-bg);border:var(--icon-border);color:var(--icon-ink);
 display:inline-flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.icon.sm{width:30px;height:30px;font-size:13px}.icon.lg{width:54px;height:54px;font-size:23px}
.step{width:38px;height:38px;border-radius:50%;background:var(--accent);color:var(--accent-fg);display:inline-flex;align-items:center;
 justify-content:center;font:700 17px var(--title-font);box-shadow:0 0 0 3px var(--paper);flex-shrink:0}
.tag{display:inline-block;background:var(--accent);color:var(--accent-fg);font:600 9.5px 'Poppins',sans-serif;letter-spacing:.12em;
 text-transform:uppercase;padding:3px 8px;border-radius:4px;align-self:flex-start}
.label-row{display:flex;align-items:center;gap:10px}
.label-row::after{content:"";flex:1;border-top:2px dashed var(--line)}
.divider{position:relative;border-top:2px dashed var(--line);margin:4px 0}
.divider::after{content:"";position:absolute;top:-6px;left:56%;width:10px;height:10px;border-radius:50%;background:var(--dot)}
.arrow{color:var(--line);font-size:18px;display:flex;align-items:center;justify-content:center}
.stat{display:flex;align-items:center;gap:12px}
.stat-num{font-family:var(--title-font);font-weight:var(--title-weight);font-size:34px;color:var(--title-ink);line-height:1;flex-shrink:0}
.stat-text{font-size:14px;line-height:1.25}
/* table */
table.table{width:100%;border-collapse:separate;border-spacing:4px;font-size:13px}
.table th{background:var(--pill-bg);color:var(--pill-fg);font-family:var(--pill-font);font-weight:400;font-size:15px;
 padding:5px 6px;border-radius:var(--pill-radius)}
.table td{background:var(--card-bg);padding:6px 8px;border-radius:4px;text-align:center;vertical-align:middle}
.table td:first-child{background:var(--paper);text-align:left;font-weight:700;color:var(--title-ink)}
.yes{color:var(--good)}.half{color:var(--mid)}.no{color:var(--bad)}
/* bars */
.bars{display:flex;flex-direction:column;gap:9px}
.bar-row{display:flex;align-items:center;gap:8px;font-size:13px}
.bar-label{width:118px;flex-shrink:0;text-align:right;font-weight:700;color:var(--title-ink)}
.bar-track{flex:1;display:flex;align-items:center;gap:6px}
.bar{height:20px;min-width:6px;background:var(--bar-bg);border-radius:4px;box-shadow:var(--bar-shadow)}
.bar.win{background:var(--bar-win)}
.bar-val{font-weight:700;white-space:nowrap}
/* timeline */
.timeline{position:relative;display:flex;flex-direction:column;gap:12px;padding-left:22px}
.timeline::before{content:"";position:absolute;left:7px;top:6px;bottom:6px;border-left:2px dashed var(--line)}
.tl-item{position:relative;display:flex;flex-direction:column;gap:2px}
.tl-item::before{content:"";position:absolute;left:-20px;top:5px;width:12px;height:12px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px var(--paper)}
.tl-date{font:600 11px 'Poppins',sans-serif;letter-spacing:.06em;color:var(--accent);text-transform:uppercase}
.tl-title{font-family:var(--title-font);font-weight:var(--title-weight);font-size:16px;color:var(--title-ink)}
.tl-text{font-size:12.5px}
/* cover */
.cover{flex:1;display:flex;flex-direction:column;gap:14px;padding:70px 30px 46px}
.cover h1{font-size:48px}
.cover .huge{font-size:84px;display:block;line-height:.95}
.byline{font:500 11px 'Poppins',sans-serif;color:var(--muted);line-height:1.4}
.byline b{display:block;font-size:13px;color:var(--title-ink)}
.swipe{font:600 12px 'Poppins',sans-serif;letter-spacing:.12em;color:var(--title-ink);text-transform:uppercase}
/* final layout pass (api/design.py): tighten a page that runs slightly long, spread one that has a hole */
.body.tight,.cover.tight{gap:6px}.cover.tight{padding-top:58px;padding-bottom:38px}.tight .subtitle{font-size:19px}
.body.spread,.cover.spread{justify-content:space-evenly}
"""

# Names the model may use. Shown in the prompt, and checked by the sanitizer.
CLASS_REFERENCE = """Layout: body (padded column, use once per page), row, col, grid-2, grid-3, grid-4, center, spacer.
Title band: <div class="band"><h1>Title</h1></div> at the top of every page except a cover.
Text: subtitle (the point of the page), lead (one sentence of context), small, muted, big (a large number or word), hl (highlighted words), kicker.
Blocks: card (with card-title and card-sub inside; add alt or white for variety), pill (a label), chips with chip inside, icon (a circle holding <i class="fa-solid fa-NAME"></i>; sizes sm, lg), step (a numbered circle), tag (a small corner label), label-row (a pill followed by a dashed rule), divider, arrow (holds <i class="fa-solid fa-arrow-right"></i>), quote (the one-line takeaway box).
Numbers: stat with stat-num and stat-text; bars with bar-row, bar-label, bar-track, bar (style="width:NN%"; add win to the best), bar-val; <table class="table"> with th headers and td cells, marks <i class="fa-solid fa-check yes"></i>, <i class="fa-solid fa-circle-half-stroke half"></i>, <i class="fa-solid fa-xmark no"></i>.
Sequences: timeline with tl-item holding tl-date, tl-title, tl-text.
Cover pages: cover (instead of body), kicker, h1 with <span class="huge hl">WORD</span>, chips, byline, swipe."""

# ---- the five styles --------------------------------------------------------------------------

STYLES: dict[str, dict] = {
    "gingham_notebook": {
        "name": "Gingham Notebook",
        "mood": "A tidy study notebook. Navy ink handwriting on cream paper, a torn blue paper title strip, beige index cards with crisp navy offset shadows. Calm, academic, trustworthy.",
        "best_for": "explainers, comparisons",
        "swatches": ["#fbf8f2", "#123d6b", "#9fc3e6", "#ede3d2", "#ffe14d"],
        "fonts": "family=Kalam:wght@300;400;700&family=Poppins:wght@400;500;600;700",
        "tokens": """--bg:#fbf8f2;--pattern:radial-gradient(rgba(18,61,107,.16) 1.3px,transparent 1.5px);--pattern-size:20px 20px;
 --ink:#123d6b;--ink-strong:#141414;--title-ink:#123d6b;--muted:#2a4a73;--paper:#ffffff;
 --title-font:'Kalam',cursive;--title-weight:700;--body-font:'Kalam',cursive;--body-size:15px;
 --card-bg:#ede3d2;--card-alt-bg:#e3ecf6;--card-border:none;--card-radius:5px;--card-shadow:4px 4px 0 #123d6b;
 --pill-bg:#123d6b;--pill-fg:#fff;--pill-radius:4px;--pill-font:'Kalam',cursive;
 --chip-bg:#fff;--chip-border:1px solid #d9dfe7;--chip-radius:6px;--chip-shadow:0 2px 5px rgba(20,40,70,.12);
 --icon-bg:#fff;--icon-border:1.5px solid #123d6b;--icon-ink:#123d6b;--accent:#123d6b;--accent-fg:#fff;
 --hl:#ffe14d;--line:#7fa9df;--dot:#7fa9df;--good:#2f7d4f;--mid:#a86b00;--bad:#a83232;
 --bar-bg:#9fc3e6;--bar-win:#123d6b;--bar-shadow:3px 3px 0 #123d6b""",
        "css": f"""
.band{{position:relative;height:76px;margin:0 0 6px;display:flex;align-items:center;justify-content:center;padding:0 30px}}
.band::before,.band::after{{content:"";position:absolute;left:0;right:0;z-index:0}}
.band::before{{top:0;bottom:0;background:#c6dcf1;clip-path:{_torn_edge(11)}}}
.band::after{{top:7px;bottom:7px;background:#9fc3e6;clip-path:{_torn_edge(23)}}}
.band h1{{position:relative;z-index:1;font-size:28px;text-align:center;color:#123d6b}}
.subtitle{{border-bottom:2px dashed #7fa9df}}
.quote{{background:#fff;border:1px solid #d9dfe7;border-radius:22px;box-shadow:0 4px 10px rgba(20,40,70,.18);padding:11px 18px;
 font-size:16.5px;text-align:center;color:#141414;font-weight:700}}
.kicker{{background:#fff;border:1.5px solid #123d6b;box-shadow:3px 3px 0 #123d6b;border-radius:20px;color:#123d6b}}""",
    },
    "sage_tape": {
        "name": "Sage Tape",
        "mood": "A craft journal. Forest-green ink, a mustard washi-tape strip as the title, sage cards, terracotta accents. Warm, friendly, hand-made.",
        "best_for": "guides, frameworks",
        "swatches": ["#fbf8f1", "#1f4d3a", "#f2c14e", "#e4ecdc", "#d9572b"],
        "fonts": "family=Gochi+Hand&family=Patrick+Hand&family=Poppins:wght@400;500;600;700",
        "tokens": """--bg:#fbf8f1;--pattern:radial-gradient(rgba(31,77,58,.17) 1.3px,transparent 1.5px);--pattern-size:20px 20px;
 --ink:#1f4d3a;--ink-strong:#1f4d3a;--title-ink:#1f4d3a;--muted:#3b5a4c;--paper:#fffdf6;
 --title-font:'Gochi Hand',cursive;--title-weight:400;--body-font:'Patrick Hand',cursive;--body-size:15.5px;
 --card-bg:#e4ecdc;--card-alt-bg:#fffdf6;--card-border:1.5px solid #1f4d3a;--card-radius:8px;--card-shadow:3px 3px 0 #1f4d3a;
 --pill-bg:#1f4d3a;--pill-fg:#fff;--pill-radius:20px;--pill-font:'Gochi Hand',cursive;
 --chip-bg:#fffdf6;--chip-border:1.5px solid #1f4d3a;--chip-radius:14px;--chip-shadow:none;
 --icon-bg:#fffdf6;--icon-border:1.5px solid #1f4d3a;--icon-ink:#1f4d3a;--accent:#d9572b;--accent-fg:#fff;
 --hl:#f7b29b;--line:#d29a2e;--dot:#f2c14e;--good:#2f7d4f;--mid:#a86b00;--bad:#a83232;
 --bar-bg:#e4ecdc;--bar-win:#1f4d3a;--bar-shadow:3px 3px 0 #1f4d3a""",
        "css": """
.band{position:relative;height:72px;margin:4px 22px 8px;display:flex;align-items:center;justify-content:center;
 background:#f2c14e;opacity:.95;transform:rotate(-1.2deg);
 background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.10) 0 2px,transparent 2px 7px);
 clip-path:polygon(0 0,100% 0,98.5% 12%,100% 24%,98.5% 36%,100% 48%,98.5% 60%,100% 72%,98.5% 84%,100% 100%,0 100%,1.5% 88%,0 76%,1.5% 64%,0 52%,1.5% 40%,0 28%,1.5% 16%)}
.band h1{font-size:31px;color:#1f4d3a;text-align:center;padding:0 20px}
.subtitle{font-size:23px;border-bottom:3px solid #f2c14e}
.quote{position:relative;background:#fff;border:2px solid #1f4d3a;border-radius:10px;box-shadow:5px 5px 0 #f2c14e;padding:12px 18px 10px 30px;
 font-family:'Gochi Hand',cursive;font-size:19px;color:#1f4d3a;text-align:center}
.quote::before{content:"\\201C";position:absolute;left:8px;top:-18px;font:44px 'Gochi Hand',cursive;color:#d9572b}
.kicker{background:#f2c14e;color:#1f4d3a;border-radius:6px;box-shadow:3px 3px 0 #1f4d3a}
.divider{border-top-style:dotted}.divider::after{width:12px;height:12px;border:2px solid #1f4d3a;top:-7px}""",
    },
    "chalk_night": {
        "name": "Chalk Night",
        "mood": "A chalkboard after class. Dark slate, chalk-white text, teal and pink pastel chalk, sketchy display font. Bold and high-contrast; stands out in a light feed.",
        "best_for": "bold takes, deep dives",
        "swatches": ["#1f2b35", "#f4efe4", "#7fd1c7", "#f58fa8", "#ffd86b"],
        "fonts": "family=Cabin+Sketch:wght@700&family=Kalam:wght@400;700&family=Poppins:wght@400;500;600;700",
        "tokens": """--bg:#1f2b35;--pattern:radial-gradient(rgba(255,255,255,.10) 1.3px,transparent 1.5px),radial-gradient(ellipse at 30% 20%,rgba(127,209,199,.07),transparent 60%);--pattern-size:20px 20px,100% 100%;
 --ink:#f4efe4;--ink-strong:#ffd86b;--title-ink:#ffffff;--muted:#c3ced6;--paper:#26343f;
 --title-font:'Cabin Sketch',cursive;--title-weight:700;--body-font:'Kalam',cursive;--body-size:15px;
 --card-bg:#2b3a46;--card-alt-bg:#33475a;--card-border:1px solid #4a5f70;--card-radius:6px;--card-shadow:4px 4px 0 #7fd1c7;
 --pill-bg:#ffd86b;--pill-fg:#1f2b35;--pill-radius:5px;--pill-font:'Kalam',cursive;
 --chip-bg:#2b3a46;--chip-border:1px solid #4a5f70;--chip-radius:6px;--chip-shadow:none;
 --icon-bg:#1f2b35;--icon-border:1.5px solid #7fd1c7;--icon-ink:#7fd1c7;--accent:#f58fa8;--accent-fg:#1f2b35;
 --hl:rgba(245,143,168,.75);--line:#7fd1c7;--dot:#7fd1c7;--good:#7ee08a;--mid:#ffd86b;--bad:#ff8a8a;
 --bar-bg:#33475a;--bar-win:#7fd1c7;--bar-shadow:3px 3px 0 #7fd1c7""",
        "css": """
.band{height:70px;margin:2px 24px 8px;display:flex;align-items:center;justify-content:center;border:2.5px solid #7fd1c7;
 border-radius:16px 5px 16px 5px;background:rgba(127,209,199,.08)}
.band h1{font-size:29px;color:#fff;text-align:center;padding:0 16px}
.subtitle{color:#ffd86b;border-bottom:2px dashed #f58fa8}
.quote{background:#26343f;border:2px dashed #ffd86b;border-radius:10px;padding:11px 18px;color:#fff;font-size:16.5px;text-align:center;font-weight:700}
.kicker{background:#f58fa8;color:#1f2b35;border-radius:6px}
.card-sub,.small{color:#c3ced6}
.table td{color:#f4efe4}.table td:first-child{color:#fff}""",
    },
    "coral_pop": {
        "name": "Coral Pop",
        "mood": "A modern product deck with sticker energy. Rounded geometric type, thick ink outlines, coral and teal on warm white. Playful but clean.",
        "best_for": "tool launches, product comparisons",
        "swatches": ["#fff6ee", "#2b2d42", "#ff7a59", "#2ec4b6", "#ffe3d3"],
        "fonts": "family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&family=Poppins:wght@400;500;600;700",
        "tokens": """--bg:#fff6ee;--pattern:radial-gradient(rgba(255,122,89,.28) 1.4px,transparent 1.6px);--pattern-size:22px 22px;
 --ink:#2b2d42;--ink-strong:#2b2d42;--title-ink:#2b2d42;--muted:#55576d;--paper:#ffffff;
 --title-font:'Fredoka',sans-serif;--title-weight:700;--body-font:'Nunito',sans-serif;--body-size:14.5px;
 --card-bg:#ffe3d3;--card-alt-bg:#d6f5f1;--card-border:2px solid #2b2d42;--card-radius:12px;--card-shadow:4px 4px 0 #2b2d42;
 --pill-bg:#2b2d42;--pill-fg:#fff;--pill-radius:30px;--pill-font:'Fredoka',sans-serif;
 --chip-bg:#fff;--chip-border:2px solid #2b2d42;--chip-radius:30px;--chip-shadow:2px 2px 0 #2b2d42;
 --icon-bg:#fff;--icon-border:2px solid #2b2d42;--icon-ink:#ff7a59;--accent:#ff7a59;--accent-fg:#fff;
 --hl:#9ef0e6;--line:#2ec4b6;--dot:#ff7a59;--good:#2f7d4f;--mid:#a86b00;--bad:#a83232;
 --bar-bg:#ffe3d3;--bar-win:#ff7a59;--bar-shadow:3px 3px 0 #2b2d42""",
        "css": """
.band{height:66px;margin:6px 22px 10px;display:flex;align-items:center;justify-content:center;background:#ff7a59;
 border:2.5px solid #2b2d42;border-radius:40px;box-shadow:5px 5px 0 #2b2d42}
.band h1{font-size:25px;color:#fff;text-align:center;padding:0 18px}
.subtitle{font-size:20px;font-weight:600;border-bottom:3px solid #2ec4b6}
.quote{background:#2b2d42;color:#fff;font:600 15.5px 'Nunito',sans-serif;border-radius:16px;box-shadow:5px 5px 0 #ff7a59;padding:12px 18px;text-align:center}
.kicker{background:#ff7a59;color:#fff;border:2px solid #2b2d42;border-radius:30px}
.chip{font-weight:600}
.divider{border-top:2.5px dotted #2ec4b6}""",
    },
    "lavender_marker": {
        "name": "Lavender Marker",
        "mood": "A student's annotated notes. Deep purple ink, highlighter strokes behind headings, dashed sketch borders, loose handwriting. Soft and approachable.",
        "best_for": "beginner guides, cheat sheets",
        "swatches": ["#fdfcff", "#3b2a6b", "#d9c8ff", "#ff5fa2", "#f1ebff"],
        "fonts": "family=Caveat:wght@600;700&family=Delius&family=Poppins:wght@400;500;600;700",
        "tokens": """--bg:#fdfcff;--pattern:radial-gradient(rgba(59,42,107,.15) 1.2px,transparent 1.4px);--pattern-size:18px 18px;
 --ink:#3b2a6b;--ink-strong:#2a1d52;--title-ink:#2a1d52;--muted:#5d4e8a;--paper:#ffffff;
 --title-font:'Caveat',cursive;--title-weight:700;--body-font:'Delius',cursive;--body-size:14.5px;
 --card-bg:#f1ebff;--card-alt-bg:#ece3ff;--card-border:1.5px dashed #3b2a6b;--card-radius:10px;--card-shadow:3px 3px 0 #b69cff;
 --pill-bg:#3b2a6b;--pill-fg:#fff;--pill-radius:8px;--pill-font:'Caveat',cursive;
 --chip-bg:#fff;--chip-border:1.5px solid #b69cff;--chip-radius:8px;--chip-shadow:none;
 --icon-bg:#fff;--icon-border:1.5px dashed #3b2a6b;--icon-ink:#3b2a6b;--accent:#ff5fa2;--accent-fg:#fff;
 --hl:rgba(217,200,255,.95);--line:#b69cff;--dot:#ff5fa2;--good:#2f7d4f;--mid:#a86b00;--bad:#a83232;
 --bar-bg:#ece3ff;--bar-win:#3b2a6b;--bar-shadow:3px 3px 0 #b69cff""",
        "css": """
.band{position:relative;height:74px;margin:0 0 6px;display:flex;align-items:center;padding:0 30px}
.band::before{content:"";position:absolute;left:20px;right:150px;top:22px;height:30px;background:#ffd1e6;transform:rotate(-1deg);border-radius:4px}
.band::after{content:"";position:absolute;left:14px;right:14px;top:30px;height:32px;background:rgba(217,200,255,.85);transform:rotate(.6deg);border-radius:4px}
.band h1{position:relative;z-index:1;font-size:38px;color:#2a1d52;text-align:left}
.subtitle{font-size:26px;background:linear-gradient(transparent 45%,#ffd1e6 45%,#ffd1e6 85%,transparent 85%)}
.card-title,.pill,.table th{font-size:20px}
.quote{background:#fff;border-left:6px solid #ff5fa2;border-radius:6px;box-shadow:0 4px 12px rgba(59,42,107,.15);padding:10px 16px;
 font:600 21px 'Caveat',cursive;color:#2a1d52}
.kicker{background:#3b2a6b;color:#fff;border-radius:8px}""",
    },
}

STYLE_IDS = tuple(STYLES)


def fonts_url(style_id: str) -> str:
    return f"https://fonts.googleapis.com/css2?{STYLES[style_id]['fonts']}&display=swap"


def style_css(style_id: str, width: int, height: int | None) -> str:
    s = STYLES[style_id]
    size = f"--w:{width}px;--h:{height}px" if height else f"--w:{width}px;--h:auto"
    return f":root{{{s['tokens']};{size}}}\n{BASE_CSS}\n{s['css']}"
