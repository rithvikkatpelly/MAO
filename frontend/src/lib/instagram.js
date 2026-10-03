import { instagram } from "./api";
import { sizeOf } from "./formats";

// What Instagram's publishing API accepts for feed posts.
export const IG_LIMITS = { images: 10, caption: 2200, hashtags: 30, minRatio: 4 / 5, maxRatio: 1.91 };

const RETURN_KEY = "aurea:instagram-return";

// Remembers where the creator started connecting, so Connections can send them back.
function rememberReturnPath(path) {
  try {
    sessionStorage.setItem(RETURN_KEY, path);
  } catch {
    /* storage unavailable: they stay on Connections */
  }
}

// Sends the browser to Instagram's sign-in page. `returnTo` is where to land afterwards.
export async function startInstagramConnect(returnTo) {
  const { url } = await instagram.connectUrl();
  if (returnTo) rememberReturnPath(returnTo);
  window.location.assign(url);
}

export function takeReturnPath() {
  try {
    const path = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return path?.startsWith("/app") ? path : null;
  } catch {
    return null;
  }
}

export function countHashtags(text) {
  return (text.match(/#[\p{L}\p{N}_]+/gu) || []).length;
}

// Problems that block posting (error) or change what gets posted (warn).
export function instagramIssues(project, caption) {
  const issues = [];
  const { w, h, label } = sizeOf(project);
  const ratio = w / h;
  if (ratio < IG_LIMITS.minRatio - 0.001 || ratio > IG_LIMITS.maxRatio) {
    issues.push({
      level: "error",
      text: `Instagram feed posts must be between 4:5 portrait and 1.91:1 landscape. ${label} (${w} x ${h}) is outside that, so switch the size to Portrait or Square in the Design tab.`,
    });
  }
  if (project.slides.length > IG_LIMITS.images) {
    issues.push({ level: "warn", text: `Instagram takes up to ${IG_LIMITS.images} images per post. Only slides 1 to ${IG_LIMITS.images} will be posted.` });
  }
  if (caption.length > IG_LIMITS.caption) {
    issues.push({ level: "error", text: `The caption is ${caption.length - IG_LIMITS.caption} characters over Instagram's ${IG_LIMITS.caption} limit.` });
  }
  if (countHashtags(caption) > IG_LIMITS.hashtags) {
    issues.push({ level: "error", text: `Instagram allows up to ${IG_LIMITS.hashtags} hashtags. This caption has ${countHashtags(caption)}.` });
  }
  return issues;
}
