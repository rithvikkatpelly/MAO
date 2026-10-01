import { formatHashtags } from "./text";

// Composer links that open each platform with the text filled in (no API access needed).
export const COMPOSERS = {
  linkedin: { label: "LinkedIn", url: (text) => `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}` },
  x: { label: "X", url: (text) => `https://x.com/intent/post?text=${encodeURIComponent(text.slice(0, 280))}` },
  threads: { label: "Threads", url: (text) => `https://www.threads.net/intent/post?text=${encodeURIComponent(text.slice(0, 500))}` },
};

export function openComposer(platform, text) {
  window.open(COMPOSERS[platform].url(text), "_blank", "noopener,noreferrer");
}

// A repurposed output as plain text, for copying and export.
export function outputToText(format, data) {
  if (!data) return "";
  switch (format) {
    case "x_thread":
      return data.posts.map((p, i) => `${i + 1}/${data.posts.length}\n${p}`).join("\n\n");
    case "linkedin_post":
      return data.text;
    case "instagram_caption":
      return [data.caption, formatHashtags(data.hashtags ?? [])].filter(Boolean).join("\n\n");
    case "newsletter":
      return `Subject: ${data.subject}\nPreview: ${data.preview}\n\n${data.blurb}`;
    case "video_script":
      return [
        data.title,
        `HOOK (0 to 3s)\nSay: ${data.hook}\nOn screen: ${data.hook_text}`,
        ...data.beats.map((b, i) => `BEAT ${i + 1}\nSay: ${b.voiceover}\nOn screen: ${b.on_screen_text}`),
        `CALL TO ACTION\nSay: ${data.cta}`,
      ].join("\n\n");
    case "youtube":
      return [
        "TITLES",
        ...data.titles.map((t, i) => `${i + 1}. ${t}`),
        "",
        "THUMBNAIL TEXT",
        ...data.thumbnail_texts.map((t, i) => `${i + 1}. ${t}`),
        "",
        "DESCRIPTION",
        data.description,
      ].join("\n");
    default:
      return "";
  }
}

// Which composer (if any) fits a format, and the text to send it.
export function composerFor(format, data) {
  if (!data) return null;
  if (format === "x_thread") return { platform: "x", text: data.posts[0] ?? "" };
  if (format === "linkedin_post") return { platform: "linkedin", text: data.text };
  return null;
}
