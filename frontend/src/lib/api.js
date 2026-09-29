import { streamPipeline } from "./sse";

export const API_BASE = (import.meta.env.VITE_API_BASE ?? "http://localhost:8000").replace(/\/$/, "");

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { online: false };
    const data = await res.json();
    return { online: true, model: data.model };
  } catch {
    return { online: false };
  }
}

export function researchIdeas({ topic, platform }, onStep, signal) {
  return streamPipeline(`${API_BASE}/api/carousel/start`, { topic, platform }, onStep, signal);
}

export function generateContent({ threadId, ideaIndex }, onStep, signal) {
  return streamPipeline(
    `${API_BASE}/api/carousel/select`,
    { thread_id: threadId, idea_index: ideaIndex },
    onStep,
    signal,
  );
}

// Turns network failures into something a creator can act on.
export function describeError(err) {
  if (err?.name === "AbortError") return null;
  if (err instanceof TypeError) {
    return "Could not reach the AI engine. Make sure the backend is running on " + API_BASE + ".";
  }
  return err?.message || "Something went wrong. Please try again.";
}
