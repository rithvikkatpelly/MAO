import { KINDS } from "./formats";
import { normalizeVisual, starterVisual } from "./visualTypes";
import { cleanProjectCopy } from "./text";
import { uid } from "./storage";

export function makeSlide(fields = {}) {
  return { id: uid(), kicker: "", headline: "", body: "", ...fields };
}

// The backend design agent picks from its own template names; map them onto ours.
const BACKEND_TEMPLATES = {
  modern: "midnight",
  minimal: "minimal",
  "tech-blue": "bold",
  corporate: "editorial",
  gradient: "gradient",
};

export function defaultDesign(kind, brand, template) {
  const multi = kind === "carousel";
  return {
    brandKitId: brand.id && brand.id !== "primary" ? brand.id : undefined,
    template: template ?? (brand.template !== "auto" ? brand.template : kind === "thumbnail" ? "bold" : "midnight"),
    accent: brand.accent,
    font: brand.font,
    align: "left",
    showBrand: true,
    showNumbers: multi,
    showArrow: multi,
    showCta: true,
  };
}

const BLANK_SLIDES = {
  carousel: [
    { kicker: "Start here", headline: "Your scroll-stopping hook goes here", body: "One line that makes people want to swipe." },
    { kicker: "Point one", headline: "Lead with the most useful idea", body: "Keep each slide to a single thought." },
    { kicker: "Point two", headline: "Back it up with a fact or example", body: "Specific beats general every time." },
    { kicker: "Point three", headline: "Give them something to try today", body: "A small, concrete action works best." },
    { kicker: "Your turn", headline: "Follow for more like this", body: "Save this post so you can find it later." },
  ],
  poster: [{ kicker: "Announcement", headline: "Say the one thing that matters", body: "Add a short supporting line with the key detail." }],
  image: [{ kicker: "New", headline: "A clear, bold headline", body: "A short line of context for your readers." }],
  thumbnail: [{ kicker: "", headline: "Big bold words", body: "" }],
};

export function blankProject(kind, brand, size) {
  const meta = KINDS[kind];
  return {
    title: `Untitled ${meta.label.toLowerCase()}`,
    kind,
    size: size ?? meta.defaultSize,
    design: defaultDesign(kind, brand),
    slides: BLANK_SLIDES[kind].map((s) => makeSlide(s)),
    caption: "",
    hashtags: [...brand.hashtags],
    cta: kind === "carousel" ? "Follow for more" : "",
    source: null,
  };
}

export function projectFromResult({ result, idea, topic, kind, size, brand, template }) {
  const aiTemplate = BACKEND_TEMPLATES[result.template] ?? "midnight";
  const chosen = template !== "auto" ? template : brand.template !== "auto" ? brand.template : aiTemplate;
  const hashtags = [...new Set([...result.hashtags.map((h) => h.replace(/^#/, "")), ...brand.hashtags])];

  return cleanProjectCopy({
    title: idea.title,
    kind,
    size,
    design: defaultDesign(kind, brand, chosen),
    slides: result.slides.map((s) => makeSlide({ headline: s.headline, body: s.body })),
    caption: result.caption,
    hashtags,
    cta: result.cta,
    sources: result.sources ?? [],
    source: { topic, idea },
  });
}

// A text-only project (thread, post, script) written from a generated post.
export function textProjectFromResult({ result, idea, topic, format, output, brand }) {
  return {
    ...cleanProjectCopy({
      title: idea.title,
      kind: "text",
      size: "",
      design: { brandKitId: brand.id && brand.id !== "primary" ? brand.id : undefined },
      // The researched slides stay on the project as context for rewrites into other formats.
      slides: result.slides.map((s) => makeSlide({ headline: s.headline, body: s.body })),
      caption: result.caption,
      hashtags: result.hashtags.map((h) => h.replace(/^#/, "")),
      cta: result.cta,
      sources: result.sources ?? [],
      source: { topic, idea },
    }),
    textFormat: format,
    outputs: { [format]: output },
  };
}

// ---- decks and infographics -------------------------------------------------------------

function studioDesign(kind, brand, template) {
  const chosen = template && template !== "auto" ? template : brand.template !== "auto" ? brand.template : "minimal";
  const deck = kind === "deck";
  // An infographic is just a title and its diagram: no brand line or page numbers unless turned on.
  return { ...defaultDesign("carousel", brand, chosen), showBrand: deck, showNumbers: deck, showArrow: false, showCta: false, showTitle: true };
}

function studioSlide({ visual, ...fields }) {
  return makeSlide({ ...fields, layout: visual ? "visual" : "standard", ...(visual ? { visual: normalizeVisual(visual) } : {}) });
}

// A deck or infographic from /api/visuals/generate.
export function studioProjectFromResult({ result, kind, brand, template, topic, idea, text = "" }) {
  return cleanProjectCopy({
    title: result.title,
    kind,
    size: kind,
    design: studioDesign(kind, brand, template),
    slides: result.slides.map((s) =>
      studioSlide({ kicker: s.kicker ?? "", headline: s.headline, body: s.body ?? "", notes: s.notes ?? "", role: s.role ?? "page", visual: s.visual }),
    ),
    caption: result.caption ?? "",
    hashtags: [...new Set([...(result.hashtags ?? []), ...brand.hashtags])],
    cta: "",
    sources: result.sources ?? [],
    // The pasted text stays with the project so "Rewrite" can rebuild the diagram from all of it.
    source: { topic, idea: idea ?? null, ...(text ? { text } : {}) },
  });
}

export function blankStudioProject(kind, brand, template) {
  const deck = [
    { role: "title", kicker: "Presentation", headline: "Your presentation title", body: "A one-line promise of what the audience gets." },
    { role: "content", kicker: "How it works", headline: "Three steps to the result", body: "", visual: starterVisual("process") },
    { role: "content", kicker: "Why it matters", headline: "What changes for your audience", body: "", visual: starterVisual("iconlist") },
    { role: "summary", kicker: "Recap", headline: "One idea to remember", body: "Close with the takeaway and a next step." },
  ];
  const infographic = [{ kicker: "", headline: "Your diagram title", body: "", visual: starterVisual("process") }];
  return {
    title: kind === "deck" ? "Untitled presentation" : "Untitled infographic",
    kind,
    size: kind,
    design: studioDesign(kind, brand, template),
    slides: (kind === "deck" ? deck : infographic).map((s) => studioSlide({ notes: "", kicker: "", role: "page", ...s })),
    caption: "",
    hashtags: [...brand.hashtags],
    cta: "",
    source: null,
  };
}
