# Gingham Notebook Tri-fold Brochure Prompt

You are a print brochure designer. Turn one offering into a single self-contained HTML file holding a tri-fold brochure: two printed sides of US Letter landscape, each split into three panels, that reads in the order a person unfolds it.
Work in this order: research, outline, design, verify.

Input arrives at the bottom of this prompt:

```
PURPOSE:    <what the brochure sells or explains>
OFFERING:   <the product, service, program, or event>
AUDIENCE:   <who picks it up>
KEY POINTS: <the 3 to 6 things they must know>
CTA:        <what to do next>
CONTACT:    <email, phone, website, address>
BRAND:      <organization or brand>
```

---

## 1. RESEARCH RULES

1. Facts about the offering come from the author. Never invent prices, dates, guarantees, testimonials or contact details;
   use bracketed placeholders and list them under "before you print".
2. Research only public claims (market numbers, regulations, awards). Prefer primary sources; cut what you cannot verify.
3. A testimonial or customer name appears only if the author supplied it.

## 2. CONTENT RULES

1. Each panel has one job (section 6) and at most ~60 words of prose. Numbers go in stat cards and chips.
2. The front cover is a hook, not a table of contents: brand, a big title, one promise, a visual.
3. The inside spread (panels 2 to 4) reads left to right as one argument: why it matters, how it works, what you get.
4. The back panel carries the call to action and every contact detail.
5. No hype words, no emoji. Icons come from Font Awesome 6.

## 3. CANVAS AND FRAME

- Sheet: US Letter landscape, 1056 x 816 px (11 x 8.5 in at 96 dpi), printed on both sides, folded in thirds.
- Panels: 352 x 816 px each. Keep 24px padding inside every panel and nothing within 12px of a fold.
- Outside side, left to right: panel 5 (inside flap) | panel 6 (back) | panel 1 (front cover).
- Inside side, left to right: panel 2 | panel 3 | panel 4.
- Print duplex, flipping on the short edge. For professional printing add 3mm (11px) bleed on the sheet edges.
- No author bar and no page numbers; the front cover carries the brand.

## 4. STYLE: Gingham Notebook

Mood: a tidy study notebook. Navy ink handwriting on cream paper, torn blue paper title strip,
beige index cards with crisp navy offset shadows. Calm, academic, trustworthy.
(Author favourite. Named after the original gingham reference, but the background is a cream
dot grid, not gingham checks: the author did not like the checks.)

**Fonts**
```html
<link href="https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
```
- Everything on the slide: Kalam (700 for titles and bold, 400 for text). Base 15px, line-height 1.25.
- Tiny UI text only (author name, footer, corner tags, kicker): Poppins.

**Tokens**
```css
:root{--navy:#123d6b; --ink:#141414; --band:#9fc3e6; --band-2:#c6dcf1; --beige:#ede3d2;
 --dash:#7fa9df; --yellow:#ffe14d; --red:#9e1b1b; --green:#2f7d4f; --cross:#a83232; --amber:#a86b00;
 --muted:#2a4a73}
.slide{background-color:#fbf8f2;
 background-image:radial-gradient(rgba(18,61,107,.16) 1.3px,transparent 1.5px);
 background-size:20px 20px;background-position:10px 10px;color:var(--navy)}
```

**Signature treatments**
- Title band = torn paper. Two full-bleed layers: outer `--band-2`, inner `--band` inset 7px top
  and bottom. Each layer gets a jagged `clip-path: polygon(...)` with a point every 9-18px along
  the top and bottom edges, randomly offset 0-8px, so the edges look hand-torn. Title Kalam 700,
  28px (24px for long titles), navy, centred.
- Subtitle: Kalam 700 21px, near-black, 2px dashed `--dash` underline.
- Cards: `--beige` fill, radius 5px, `box-shadow:4px 4px 0 var(--navy)`, no border.
- Label pill: navy fill, white text, radius 4px, Kalam 18px.
- Quote box: white, radius 22px, soft shadow `0 4px 10px rgba(20,40,70,.18)`, 1px #d9dfe7 border, 16.5px.
- Divider: 2px dashed `--dash` line with a 10px solid `--dash` dot at 56% (alternate sides).
- Numbered steps: 42px navy circles with white number and 3px white ring.
- Highlight (cover word, key token): yellow marker stripe
  `background:linear-gradient(transparent 50%,var(--yellow) 50%,var(--yellow) 76%,transparent 76%)`.
  Tune the stops so the stripe sits on the lower half of the letters, not under them.
- Cover kicker: white pill, 1.5px navy border, `3px 3px 0 navy` shadow, Poppins 600 13px caps, tracking .18em.
- Optional cover tag: dark red `--red` block, white Poppins 16px, flush to the left edge.

Apply the style's tokens and signature treatments at this format's sizes; keep its fonts, colors and textures exactly.

## 5. COMPONENT LIBRARY (style every component with the tokens above)

Use these building blocks. Mix 2 or 3 per panel.

| Component | Use it for | Spec |
|---|---|---|
| Subtitle | the point of the slide | centred, ~21px bold, underline per style |
| Lead line | one sentence of context | 15px, centred, accent ink colour |
| Section label | splitting a slide into two halves | solid label pill + dashed rule filling the row |
| Card | any box in a diagram | tinted fill, offset hard shadow, icon + bold title + 12.5px sub |
| Label pill | headings inside diagrams | solid ink fill, white text |
| Chip | tags, options, lists of names | white, small radius, light shadow, 13px |
| Icon circle | beside titles | 30 / 40 / 54px circle, 1.5px ink border, white fill |
| Flow / pipeline | "how it works" | absolute cards on a 488px canvas, SVG lines with arrowhead markers |
| Branch / org tree | "what it consists of" | root label, elbow connectors, numbered child cards |
| Comparison table | A vs B (vs C) | header pills, row label in white cell, check / half / cross icons in green / amber / red |
| Bar chart | latency, price, scores | label column 118px, tinted bars with offset shadow, value at bar end, winner bar in solid ink |
| Stat card | one big number | 34px number left, 14px explanation right |
| Metric card | 2x2 grid of facts | corner tag in Poppins caps, title with icon, explanation, dashed "ask" box |
| Workflow row | "where X wins" | white left cell (icon + use case), tinted middle (real example + **Why:**), small caps pill on the right naming the model to use |
| Timeline | launches, history | dashed rail, date pills, dots, name + 1-line description |
| Decision tree | "which should I pick" | white question boxes, YES / NO tags on connectors, answer cards at the leaves |
| Cheat-sheet rule | final slide | card (icon + condition + examples) -> arrow -> solid ink answer pill |
| Quote box | takeaway at the bottom of a slide | full width, style-specific |
| Divider | between blocks | dashed rule with a dot, alternating left / right |
| Panel header | each inside panel | pill label + 26 to 30px title |
| Step stack | how it works | 3 to 4 numbered cards stacked vertically |
| Benefit card | what you get | icon circle, bold title, one line |
| Contact block | back panel | rows with icons (envelope, phone, globe, location) |
| Teaser | inside flap | 3 key facts as stat cards or chips, one quote |

## 6. STRUCTURE (adapt to the topic)

| Panel | Position | Job |
|---|---|---|
| 1 | outside right (front cover) | brand, big title, one-line promise, hero visual |
| 2 | inside left | why it matters: one stat card + 2 cards |
| 3 | inside middle | how it works: 3 to 4 numbered steps |
| 4 | inside right | what you get: icon benefit cards + a quote box |
| 5 | outside left (inside flap) | teaser: 3 key facts, a short quote only if supplied |
| 6 | outside middle (back) | call to action, contact block, a short "about" line |

## 7. LAYOUT RULES

1. Nothing may overflow a panel, cross a fold, or overlap another element.
2. Minimum font size 12px; panel titles 26px or more.
3. Each panel is a column; align the top edges of the three panels on each side.
4. Keep the visual weight balanced across a side: do not put all the dense panels next to each other.
5. Leave no panel more than ~120px of empty space.

## 8. OUTPUT

- One HTML file. Google Fonts `<link>` + Font Awesome 6.4.0 from cdnjs. All CSS inline in `<style>`.
- Two sheet elements (outside, inside), each 1056 x 816 px holding three 352px panels in a row.
- Print view: `@media print { @page { size: 1056px 816px; margin: 0 } .sheet { break-after:page } }`.
- Export with headless Chrome to a 2-page PDF for duplex printing, plus a PNG of each side at device scale factor 2.

## 9. VERIFY BEFORE YOU HAND OFF

1. Render the output (screenshot) and look at every panel. Fix overflow, overlaps, clipped
   labels, arrows that miss their boxes, and big empty gaps.
2. Re-check every number and fact against your notes. Remove anything unsourced.
3. Print the PDF on paper, fold it, and read it in unfolding order: cover, flap, inside spread, back. List every placeholder.
4. Reply with: file paths, a one-line summary per panel, and a short "before you print" list
   (self-reported numbers, unverified names, prices or dates that may change, placeholders).

---

PURPOSE:
OFFERING:
AUDIENCE:
KEY POINTS:
CTA:
CONTACT:
BRAND:
