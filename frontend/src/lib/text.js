// House style for slide copy: no em dashes, no en dashes, no emojis.
// Applied to everything the AI returns; the editor flags anything typed by hand.

const RANGE_DASH = /(?<=\d)\s*[\u2013\u2014]\s*(?=\d)/g;
const DASH = /\s*[\u2013\u2014\u2015]+\s*/g;
// Extended_Pictographic also matches (c), (R) and TM signs, which are fine to keep.
const EMOJI = /(?:(?![\u00A9\u00AE\u2122])\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|\uFE0F|\u200D|\u20E3)/gu;

export function cleanText(text = "") {
  return text
    .replace(RANGE_DASH, "-")
    .replace(DASH, ", ")
    .replace(EMOJI, "")
    .replace(/,,/g, ",")
    .replace(/[ \t]+([,.!?;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "");
}

export function hasStyleIssues(text = "") {
  return /[\u2013\u2014\u2015]/.test(text) || new RegExp(EMOJI.source, "u").test(text);
}

export function cleanHashtag(tag = "") {
  return cleanText(tag).replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
}

export function projectHasStyleIssues(project) {
  return (
    project.slides.some((s) => hasStyleIssues(s.kicker) || hasStyleIssues(s.headline) || hasStyleIssues(s.body)) ||
    hasStyleIssues(project.caption) ||
    hasStyleIssues(project.cta)
  );
}

export function cleanProjectCopy(project) {
  return {
    ...project,
    title: cleanText(project.title) || "Untitled",
    slides: project.slides.map((s) => ({
      ...s,
      kicker: cleanText(s.kicker),
      headline: cleanText(s.headline),
      body: cleanText(s.body),
    })),
    caption: cleanText(project.caption),
    cta: cleanText(project.cta),
    hashtags: project.hashtags.map(cleanHashtag).filter(Boolean),
  };
}

export function formatHashtags(tags) {
  return tags.map((t) => `#${t}`).join(" ");
}
