import { useMemo, useSyncExternalStore } from "react";
import { api } from "./api";
import { updateProfile, useAuth } from "./auth";

// Projects are stored per user in Postgres. The editor works on an in-memory copy
// that updates instantly; writes go to the server in the background.

let state = { status: "idle", owner: null, items: [] };
const listeners = new Set();
const errorListeners = new Set();

function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function reportError(message) {
  errorListeners.forEach((l) => l(message));
}

export function onSyncError(listener) {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

export function useProjectsState() {
  return useSyncExternalStore(subscribe, () => state);
}

export function useProjects() {
  return useProjectsState().items;
}

export function useProject(id) {
  return useProjects().find((p) => p.id === id) ?? null;
}

export function uid() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function strip(project) {
  const { id: _id, createdAt: _c, updatedAt: _u, ...data } = project;
  return data;
}

// Projects made before accounts existed lived in this browser only; move them to the account once.
const LEGACY_KEY = "aurea.projects.v1";

async function importLegacyProjects() {
  let legacy = [];
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(legacy) || !legacy.length) return [];
  const imported = [];
  for (const p of legacy) {
    try {
      imported.push(await api(`/api/projects/${p.id}`, { method: "PUT", body: strip(p) }));
    } catch {
      // skip anything the server rejects; the rest still move over
    }
  }
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // storage blocked: nothing to clean up
  }
  return imported;
}

export async function loadProjects(userId) {
  if (state.owner === userId && state.status !== "error") return;
  set({ status: "loading", owner: userId, items: [] });
  try {
    const items = await api("/api/projects");
    const imported = await importLegacyProjects();
    const ids = new Set(items.map((p) => p.id));
    set({ status: "ready", items: [...imported.filter((p) => !ids.has(p.id)), ...items] });
  } catch (err) {
    set({ status: "error" });
    reportError(err.message);
  }
}

export function resetProjects() {
  set({ status: "idle", owner: null, items: [] });
}

function upsertLocal(project) {
  set({ items: [project, ...state.items.filter((p) => p.id !== project.id)] });
}

export function insertProject(data) {
  const now = new Date().toISOString();
  const project = { ...data, id: uid(), createdAt: now, updatedAt: now };
  upsertLocal(project);
  api(`/api/projects/${project.id}`, { method: "PUT", body: strip(project) }).catch((err) =>
    reportError(`Could not save "${project.title}": ${err.message}`),
  );
  return project;
}

// Resolves to true once the server has the change. `keepalive` lets it finish while the page unloads.
export async function saveProject(project, { keepalive = false } = {}) {
  upsertLocal({ ...project, updatedAt: new Date().toISOString() });
  try {
    await api(`/api/projects/${project.id}`, { method: "PUT", body: strip(project), keepalive });
    return true;
  } catch {
    return false;
  }
}

export function deleteProject(id) {
  set({ items: state.items.filter((p) => p.id !== id) });
  api(`/api/projects/${id}`, { method: "DELETE" }).catch((err) => reportError(`Could not delete the project: ${err.message}`));
}

export function duplicateProject(id) {
  const source = state.items.find((p) => p.id === id);
  if (!source) return null;
  return insertProject({
    ...structuredClone(strip(source)),
    title: `${source.title} (copy)`,
    slides: source.slides.map((s) => ({ ...s, id: uid() })),
  });
}

// ---- brand kit (stored on the user's profile) ------------------------------

export const DEFAULT_BRAND = {
  name: "Your Brand",
  handle: "@yourhandle",
  accent: "#ff5a3c",
  secondary: "",
  palette: [],
  mark: "initials",
  logo: "",
  avatar: "",
  template: "auto",
  font: "auto",
  hashtags: [],
};

export function useBrand() {
  const { profile } = useAuth();
  const saved = profile?.brand;
  return useMemo(() => ({ ...DEFAULT_BRAND, ...saved }), [saved]);
}

export async function saveBrand(next) {
  try {
    await updateProfile({ brand: { ...DEFAULT_BRAND, ...next } });
    return true;
  } catch {
    return false;
  }
}
