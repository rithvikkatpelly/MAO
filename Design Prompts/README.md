# Carousel Style Prompts

Five ready-to-use system prompts for an LLM application that generates LinkedIn
carousels (540 x 675 HTML slides, exportable to PDF). Each file is self-contained:
research rules, content rules, frame, style tokens, component library, deck
structure, layout rules, output format and a verification checklist.

| File | Style | Look | Best for |
|---|---|---|---|
| `01_gingham_notebook.md` | Gingham Notebook | navy handwriting, torn blue title strip, beige cards, cream dot grid | explainers, comparisons (favourite) |
| `02_sage_tape.md` | Sage Tape | forest ink, mustard washi tape, sage cards, terracotta accents | guides, frameworks (favourite) |
| `03_chalk_night.md` | Chalk Night | dark slate chalkboard, teal / pink / yellow chalk | bold takes, deep dives |
| `04_coral_pop.md` | Coral Pop | coral sticker pills, thick ink outlines, rounded type | tool launches, product comparisons |
| `05_lavender_marker.md` | Lavender Marker | purple ink, highlighter titles, dashed sketch cards | beginner guides, cheat sheets |

## How to use

1. Load one file as the system prompt (or prepend it to the user message).
2. Fill the input block at the bottom: TOPIC, NOTES, AUDIENCE, SLIDES, AUTHOR, BRAND.
3. The model needs web search for the research step and, ideally, a way to render
   screenshots for the verify step.
4. Output is one HTML file. Print it to PDF with headless Chrome for LinkedIn:
   `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer --print-to-pdf=out.pdf file:///path/to/carousel.html`

## Reference builds

- Gingham Notebook, full deck: `../llm_vs_decision_models/` (12 slides, HTML + PDF)
- All five styles as templates: `../gingham_templates/`, `../sage_tape_templates/`,
  `../chalk_night_templates/`, `../coral_pop_templates/`, `../lavender_marker_templates/`
- Shared CSS source of truth: `../gingham_templates/builder/build.py`

## Other formats

The same five styles, as self-contained prompts for four more formats. Section 4 of each file is
copied word for word from the carousel prompt above; sections 1 to 3 and 5 to 9 are rewritten for
the format's size, structure and output.

| Folder | Format | Canvas (CSS px, exported at 2x) | Output |
|---|---|---|---|
| `slides/` | Presentation | 960 x 540 (16:9) | multi-page PDF, PNG per slide, speaker notes |
| `infographic/` | Vertical infographic | 800 wide, 2000 to 2400 tall | one tall PDF page, one PNG |
| `flyer/` | Flyer | 794 x 1123 (A4 portrait) | one-page PDF, PNG |
| `brochure/` | Tri-fold brochure | 1056 x 816 per side (US Letter landscape), 6 panels of 352 x 816 | 2-page duplex PDF, PNG per side |

These files are generated. After editing a carousel prompt, rebuild them:

```
cd backend && uv run python -m design.build_prompts
```

The app's design studio (Create in the sidebar) uses the same styles: `backend/design/styles.py`
turns each style's tokens and signature treatments into CSS, and the local model writes each page's
HTML freely with those components, one page at a time, then every page is rendered and checked
for overflow and empty space before it is shown.
