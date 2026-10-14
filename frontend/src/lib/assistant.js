// The editor assistant's edit operations (backend/api/assistant.py), applied to a project.
// Slide numbers in operations refer to the project as it was sent, so every slide is resolved
// to its id first; adds, deletes, and moves in the same answer then cannot shift each other.
import { SLIDE_LIMIT, isStudioKind } from "./formats";
import { makeSlide } from "./project";
import { TEMPLATES } from "./templates";
import { VISUAL_TYPES, convertVisual, normalizeVisual, starterVisual } from "./visualTypes";

const cut = (value, n) => String(value ?? "").slice(0, n);

// The slice of a project the assistant reads. Images and styling details stay in the browser.
export function projectForAssistant(project) {
  return {
    title: cut(project.title, 200),
    kind: project.kind,
    slides: project.slides.slice(0, SLIDE_LIMIT).map((s) => ({
      kicker: cut(s.kicker, 80),
      headline: cut(s.headline, 300),
      body: cut(s.body, 1500),
      notes: cut(s.notes, 1500),
      role: cut(s.role, 20),
      visual: s.visual
        ? {
            type: cut(s.visual.type, 20),
            items: (s.visual.items ?? []).slice(0, 12).map((i) => ({ label: cut(i.label, 80), detail: cut(i.detail, 200), value: cut(i.value, 30) })),
            extra: Object.fromEntries(
              Object.entries(s.visual.extra ?? {})
                .filter(([k, v]) => k.length <= 20 && typeof v === "string")
                .slice(0, 8)
                .map(([k, v]) => [k, cut(v, 80)]),
            ),
          }
        : null,
    })),
    caption: cut(project.caption, 3000),
    cta: cut(project.cta, 200),
    hashtags: (project.hashtags ?? []).slice(0, 30).map((h) => cut(h, 40)),
    template: cut(project.design?.template, 30),
    accent: cut(project.design?.accent, 9),
    sources: (project.sources ?? []).slice(0, 10).map((s) => cut(s.title, 300)),
  };
}

export function maxSlidesFor(kind) {
  return kind === "carousel" || isStudioKind(kind) ? SLIDE_LIMIT : 1;
}

const FIELD_NAMES = { kicker: "label", headline: "headline", body: "body", notes: "speaker notes" };

function applyVisual(slide, op) {
  const type = VISUAL_TYPES[op.visual_type] ? op.visual_type : null;
  let visual = slide.visual ? normalizeVisual(slide.visual) : starterVisual(type ?? "iconlist");
  if (type && type !== visual.type) visual = convertVisual(visual, type);
  if (Array.isArray(op.items) && op.items.length) {
    const half = Math.ceil(op.items.length / 2);
    const items = op.items.map((it, i) => ({
      label: it.label ?? "",
      detail: it.detail ?? "",
      value: String(it.value ?? ""),
      icon: it.icon ?? visual.items[i]?.icon ?? "check",
      group: visual.type === "comparison" ? (i < half ? 0 : 1) : (visual.items[i]?.group ?? 0),
    }));
    // convertVisual to the same type clamps the item count to what the diagram supports
    visual = { ...convertVisual({ ...visual, items }, visual.type), variant: visual.variant };
  }
  const extra = { ...visual.extra };
  if (op.extra?.center) extra.center = op.extra.center;
  if (op.extra?.left_title) extra.left = op.extra.left_title;
  if (op.extra?.right_title) extra.right = op.extra.right_title;
  return { ...slide, layout: "visual", visual: { ...visual, extra } };
}

// Returns { project, changes }: the edited project and a short line per change for the chat.
export function applyOperations(project, operations, { maxSlides = maxSlidesFor(project.kind) } = {}) {
  const ids = project.slides.map((s) => s.id);
  const idAt = (n) => (Number.isInteger(n) && n >= 1 && n <= ids.length ? ids[n - 1] : null);
  let slides = project.slides.map((s) => ({ ...s }));
  const find = (id) => slides.findIndex((s) => s.id === id);
  const next = { ...project, design: { ...project.design } };
  const changes = [];
  const studio = isStudioKind(project.kind);

  // 1. content edits, against the original numbering
  for (const op of operations) {
    if (op.op === "update_slide") {
      const at = find(idAt(op.slide));
      if (at < 0) continue;
      const fields = Object.keys(FIELD_NAMES).filter((k) => typeof op[k] === "string");
      if (!fields.length) continue;
      slides[at] = { ...slides[at], ...Object.fromEntries(fields.map((k) => [k, op[k]])) };
      changes.push(`Slide ${op.slide}: new ${fields.map((k) => FIELD_NAMES[k]).join(", ")}`);
    } else if (op.op === "set_visual" && studio) {
      const at = find(idAt(op.slide));
      if (at < 0) continue;
      slides[at] = applyVisual(slides[at], op);
      changes.push(`Slide ${op.slide}: ${VISUAL_TYPES[slides[at].visual.type].label.toLowerCase()} diagram`);
    } else if (op.op === "update_post") {
      if (typeof op.caption === "string") {
        next.caption = op.caption;
        changes.push("New caption");
      }
      if (typeof op.cta === "string") {
        next.cta = op.cta;
        changes.push("New call to action");
      }
      const remove = new Set((op.remove_hashtags ?? []).map((h) => h.replace(/^#/, "").toLowerCase()));
      const add = (op.add_hashtags ?? []).map((h) => h.replace(/^#/, "")).filter(Boolean);
      if (remove.size || add.length) {
        const kept = (project.hashtags ?? []).filter((h) => !remove.has(h.toLowerCase()));
        const seen = new Set(kept.map((h) => h.toLowerCase()));
        next.hashtags = [...kept, ...add.filter((h) => !seen.has(h.toLowerCase()) && seen.add(h.toLowerCase()))].slice(0, 30);
        changes.push([add.length && `Added ${add.length} hashtag${add.length > 1 ? "s" : ""}`, remove.size && `removed ${remove.size}`].filter(Boolean).join(", "));
      }
    } else if (op.op === "update_design") {
      if (op.template && TEMPLATES[op.template]) {
        next.design.template = op.template;
        changes.push(`Template: ${TEMPLATES[op.template].label ?? op.template}`);
      }
      if (/^#[0-9a-fA-F]{6}$/.test(op.accent ?? "")) {
        next.design.accent = op.accent;
        changes.push(`Accent color ${op.accent}`);
      }
    }
  }

  // 2. structure: deletes, then adds, then moves, all by slide id
  for (const op of operations) {
    if (op.op !== "delete_slide" || slides.length <= 1) continue;
    const at = find(idAt(op.slide));
    if (at < 0) continue;
    slides.splice(at, 1);
    changes.push(`Deleted slide ${op.slide}`);
  }
  for (const op of operations) {
    if (op.op !== "add_slide" || slides.length >= maxSlides) continue;
    const anchor = op.slide === 0 ? -1 : find(idAt(op.slide));
    const at = op.slide === 0 ? 0 : anchor >= 0 ? anchor + 1 : slides.length;
    const fields = { kicker: op.kicker ?? "", headline: op.headline ?? "", body: op.body ?? "" };
    slides.splice(at, 0, makeSlide(studio ? { ...fields, notes: op.notes ?? "", role: "content", layout: "standard" } : fields));
    changes.push(op.slide === 0 ? "Added a slide at the start" : `Added a slide after slide ${op.slide}`);
  }
  for (const op of operations) {
    if (op.op !== "move_slide") continue;
    const from = find(idAt(op.slide));
    if (from < 0) continue;
    const [moved] = slides.splice(from, 1);
    slides.splice(Math.max(0, Math.min(op.to - 1, slides.length)), 0, moved);
    changes.push(`Moved slide ${op.slide} to position ${op.to}`);
  }

  next.slides = slides;
  return { project: next, changes };
}

export const SUGGESTIONS = {
  carousel: ["Make every slide punchier", "Write a stronger hook for slide 1", "Add a slide with a concrete example", "Shorten the caption and add 3 hashtags"],
  deck: ["Make the slides shorter", "Turn this slide into a timeline", "Add a summary slide at the end", "Rewrite the speaker notes to sound natural"],
  infographic: ["Use a different diagram that fits better", "Make the labels shorter", "Sharpen the title", "Add one more point"],
  single: ["Make the headline punchier", "Shorten the body", "Try a bolder template", "Write a caption for LinkedIn"],
};

export function suggestionsFor(kind) {
  return SUGGESTIONS[kind] ?? SUGGESTIONS.single;
}
