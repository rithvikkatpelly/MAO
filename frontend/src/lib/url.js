// Only web links become clickable. Anything else (javascript:, data:, malformed) returns null,
// so callers render plain text instead of a link.
export function safeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}
