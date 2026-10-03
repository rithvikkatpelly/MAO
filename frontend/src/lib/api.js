import { streamPipeline } from "./sse";

export const API_BASE = (import.meta.env.VITE_API_BASE ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// JSON request to the backend, sending the session cookie.
export async function api(path, { method = "GET", body, keepalive = false } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    keepalive,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : `Request failed (${res.status})`;
    throw new ApiError(res.status, detail);
  }
  return data;
}

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

export function researchIdeas({ topic, platform, kind, slideCount }, onStep, signal) {
  return streamPipeline(
    `${API_BASE}/api/carousel/start`,
    { topic, platform, kind, slide_count: kind === "carousel" ? slideCount : null },
    onStep,
    signal,
  );
}

// Skips research for an idea the creator already has; continue with generateContent(index 0).
export function startFromIdea({ idea, topic, platform, kind, slideCount }) {
  return api("/api/carousel/from-idea", {
    method: "POST",
    body: {
      idea: { title: idea.title, angle: idea.angle || idea.title, reason: idea.reason || "" },
      topic,
      platform,
      kind,
      slide_count: kind === "carousel" ? slideCount : null,
    },
  });
}

// ---- quick AI helpers (single model call each) ----
export const ai = {
  slide: (body) => api("/api/ai/slide", { method: "POST", body }),
  repurpose: (format, project) => api("/api/ai/repurpose", { method: "POST", body: { format, project } }),
  captions: (platforms, project) => api("/api/ai/captions", { method: "POST", body: { platforms, project } }),
  planWeek: (body) => api("/api/ai/plan-week", { method: "POST", body }),
};

// Saved snapshots of a project (backend/api/projects.py).
export const versions = {
  list: (projectId) => api(`/api/projects/${projectId}/versions`),
  get: (projectId, versionId) => api(`/api/projects/${projectId}/versions/${versionId}`),
  create: (project, reason, label = "") => {
    const { id, createdAt: _c, updatedAt: _u, ...data } = project;
    return api(`/api/projects/${id}/versions`, { method: "POST", body: { reason, label, data } });
  },
};

export const trendWatch = {
  get: () => api("/api/trends/settings"),
  save: (settings) => api("/api/trends/settings", { method: "PUT", body: settings }),
  run: () => api("/api/trends/run", { method: "POST" }),
};

// The slice of a project the AI helpers need.
export function projectForAI(project) {
  return {
    title: project.title || "",
    kind: project.kind,
    slides: (project.slides || []).map((s) => ({ kicker: s.kicker || "", headline: s.headline || "", body: s.body || "" })),
    caption: project.caption || "",
    cta: project.cta || "",
    sources: (project.sources || []).slice(0, 10).map((s) => ({ title: s.title || "", url: s.url || "" })),
    idea: project.source?.idea ? `${project.source.idea.title}: ${project.source.idea.angle}` : "",
  };
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
