import { useMemo, useSyncExternalStore } from "react";

// Projects and the brand kit live in the browser (localStorage), synced across tabs.
// Every access is guarded: storage can be full, blocked, or unavailable.

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function createStore(key, fallback) {
  let value = read(key, fallback);
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l());

  window.addEventListener("storage", (e) => {
    if (e.key === key) {
      value = read(key, fallback);
      emit();
    }
  });

  return {
    get: () => value,
    set(next) {
      value = typeof next === "function" ? next(value) : next;
      const ok = write(key, value);
      emit();
      return ok;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// ---- projects ------------------------------------------------------------

const projects = createStore("aurea.projects.v1", []);

export function useProjects() {
  return useSyncExternalStore(projects.subscribe, projects.get);
}

export function useProject(id) {
  const all = useProjects();
  return all.find((p) => p.id === id) ?? null;
}

export function uid() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function insertProject(data) {
  const now = new Date().toISOString();
  const project = { ...data, id: uid(), createdAt: now, updatedAt: now };
  const ok = projects.set((all) => [project, ...all]);
  if (!ok) throw new Error("Browser storage is full. Delete a few projects and try again.");
  return project;
}

// Returns false when the browser refused the write (quota or privacy mode).
export function saveProject(project) {
  const updated = { ...project, updatedAt: new Date().toISOString() };
  return projects.set((all) => [updated, ...all.filter((p) => p.id !== project.id)]);
}

export function deleteProject(id) {
  projects.set((all) => all.filter((p) => p.id !== id));
}

export function duplicateProject(id) {
  const source = projects.get().find((p) => p.id === id);
  if (!source) return null;
  return insertProject({
    ...structuredClone(source),
    title: `${source.title} (copy)`,
    slides: source.slides.map((s) => ({ ...s, id: uid() })),
  });
}

// ---- brand kit -----------------------------------------------------------

export const DEFAULT_BRAND = {
  name: "Your Brand",
  handle: "@yourhandle",
  accent: "#ff5a3c",
  template: "auto",
  font: "auto",
  hashtags: [],
};

const brand = createStore("aurea.brand.v1", DEFAULT_BRAND);

export function useBrand() {
  const value = useSyncExternalStore(brand.subscribe, brand.get);
  return useMemo(() => ({ ...DEFAULT_BRAND, ...value }), [value]);
}

export function saveBrand(next) {
  return brand.set(next);
}
