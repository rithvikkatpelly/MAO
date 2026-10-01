import { hasStyleIssues } from "./text";

// Instant, rule-based checks that run in the browser before posting.

const WEAK_OPENERS = [
  "in this post",
  "let's talk",
  "lets talk",
  "here are some",
  "i wanted to share",
  "thoughts",
  "a few thoughts",
  "today i",
  "have you ever",
  "did you know",
];
const POWER_WORDS = [
  "mistake",
  "mistakes",
  "stop",
  "never",
  "secret",
  "truth",
  "why",
  "how",
  "only",
  "without",
  "fastest",
  "simple",
  "proven",
  "exactly",
  "nobody",
  "wrong",
  "costly",
  "before",
  "instead",
];

const words = (text) => (text.toLowerCase().match(/[a-z0-9']+/g) ?? []);

// 0 to 100, with the reasons behind the score.
export function hookScore(headline = "") {
  const text = headline.trim();
  if (!text) return { score: 0, tips: ["Write a headline for your first slide."], good: [] };
  const w = words(text);
  let score = 45;
  const tips = [];
  const good = [];

  if (w.length >= 4 && w.length <= 10) {
    score += 15;
    good.push("Short enough to read at a glance");
  } else if (w.length > 14) {
    score -= 15;
    tips.push("Cut it to 10 words or fewer.");
  } else if (w.length < 4) {
    score -= 5;
    tips.push("Add a little specificity; very short hooks can read as vague.");
  } else tips.push("Aim for 4 to 10 words.");

  if (/\d/.test(text)) {
    score += 12;
    good.push("Uses a specific number");
  } else tips.push("Add a number: a count, a result, or a timeframe.");

  if (w.some((x) => x === "you" || x === "your" || x === "you're")) {
    score += 8;
    good.push("Speaks to the reader");
  } else tips.push("Speak to the reader with 'you' or 'your'.");

  if (w.some((x) => POWER_WORDS.includes(x))) {
    score += 10;
    good.push("Has a curiosity or stakes word");
  } else tips.push("Raise the stakes: a mistake to avoid, a result, or a surprising claim.");

  const lower = text.toLowerCase();
  if (WEAK_OPENERS.some((o) => lower.startsWith(o))) {
    score -= 20;
    tips.push("Skip the warm-up opener and lead with the point.");
  }
  if (text.endsWith("?") && w.length <= 8) score += 3;
  if (hasStyleIssues(text)) {
    score -= 10;
    tips.push("Remove em dashes and emojis.");
  }
  return { score: Math.max(0, Math.min(100, score)), tips, good };
}

// Flesch reading ease (higher is easier; 60+ is plain English).
export function readingEase(text) {
  const sentences = Math.max(1, (text.match(/[.!?]+/g) ?? []).length);
  const w = words(text);
  if (!w.length) return 100;
  const syllables = w.reduce((sum, word) => sum + Math.max(1, (word.replace(/e$/, "").match(/[aeiouy]+/g) ?? []).length), 0);
  return Math.round(206.835 - 1.015 * (w.length / sentences) - 84.6 * (syllables / w.length));
}

// Returns [{ id, label, status: "pass" | "warn" | "fail", detail }]
export function prePublishChecklist(project) {
  const slides = project.slides ?? [];
  const multi = slides.length > 1;
  const checks = [];
  const add = (id, label, status, detail) => checks.push({ id, label, status, detail });

  const hook = hookScore(slides[0]?.headline);
  add("hook", "Strong hook", hook.score >= 70 ? "pass" : hook.score >= 50 ? "warn" : "fail", `Hook score ${hook.score} of 100`);

  const dense = slides
    .map((s, i) => ({ i, n: words(`${s.headline} ${s.body} ${(s.items ?? []).join(" ")}`).length }))
    .filter((s) => s.n > 45);
  add(
    "density",
    "Text density",
    dense.length ? "warn" : "pass",
    dense.length ? `Slide ${dense.map((d) => d.i + 1).join(", ")} ${dense.length > 1 ? "have" : "has"} over 45 words` : "Every slide is easy to scan",
  );

  const allText = slides.map((s) => `${s.headline}. ${s.body}`).join(" ");
  const ease = readingEase(allText);
  add("readability", "Readability", ease >= 60 ? "pass" : ease >= 45 ? "warn" : "fail", `Reading ease ${ease} (60 or more reads easily)`);

  const hasCta = project.cta?.trim() && project.design?.showCta;
  add("cta", "Call to action", hasCta ? "pass" : "fail", hasCta ? `"${project.cta}" on the last slide` : "Add a call to action and turn it on in Design");

  if (project.kind === "carousel") {
    const n = slides.length;
    add("length", "Carousel length", n >= 5 && n <= 10 ? "pass" : "warn", `${n} slides (5 to 10 perform best)`);
  }

  const tags = project.hashtags?.length ?? 0;
  add("caption", "Caption", project.caption?.trim() ? "pass" : "warn", project.caption?.trim() ? "Caption written" : "Write a caption before posting");
  add("hashtags", "Hashtags", tags >= 3 && tags <= 5 ? "pass" : "warn", `${tags} hashtag${tags === 1 ? "" : "s"} (3 to 5 is the sweet spot)`);

  const style = slides.some((s) => hasStyleIssues(`${s.kicker} ${s.headline} ${s.body}`)) || hasStyleIssues(project.caption);
  add("style", "No em dashes or emojis", style ? "fail" : "pass", style ? "Clean them up in the Slide tab" : "House style respected");

  if (multi) {
    const empty = slides.findIndex((s) => !s.headline?.trim() && (s.layout ?? "standard") === "standard");
    add("empty", "No empty slides", empty === -1 ? "pass" : "fail", empty === -1 ? "Every slide has a headline" : `Slide ${empty + 1} has no headline`);
  }
  return checks;
}
