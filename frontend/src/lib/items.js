import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import { uid } from "./storage";

// Per-user collections stored on the server (see backend/api/items.py):
// idea, series, brand_kit, preset, font, metric. Each kind loads once and
// updates optimistically; failed writes roll back and rethrow.

const stores = {};
const listeners = new Set();

function store(kind) {
  stores[kind] ??= { status: "idle", items: [] };
  return stores[kind];
}

function set(kind, patch) {
  stores[kind] = { ...store(kind), ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadItems(kind, { force = false } = {}) {
  const current = store(kind);
  if (!force && (current.status === "loading" || current.status === "ready")) return;
  set(kind, { status: "loading" });
  try {
    set(kind, { status: "ready", items: await api(`/api/items/${kind}`) });
  } catch {
    set(kind, { status: "error" });
  }
}

export function useItems(kind) {
  const snapshot = useSyncExternalStore(subscribe, () => store(kind));
  useEffect(() => {
    loadItems(kind);
  }, [kind]);
  return snapshot;
}

export async function saveItem(kind, item) {
  const id = item.id ?? uid();
  const before = store(kind).items;
  const optimistic = { ...item, id, updatedAt: new Date().toISOString() };
  set(kind, { items: [optimistic, ...before.filter((i) => i.id !== id)] });
  try {
    const saved = await api(`/api/items/${kind}/${id}`, { method: "PUT", body: item });
    set(kind, { items: store(kind).items.map((i) => (i.id === id ? saved : i)) });
    return saved;
  } catch (err) {
    set(kind, { items: before });
    throw err;
  }
}

export async function saveItems(kind, items) {
  const withIds = items.map((i) => ({ ...i, id: i.id ?? uid() }));
  const saved = await api(`/api/items/${kind}/bulk`, { method: "POST", body: { items: withIds } });
  const ids = new Set(saved.map((i) => i.id));
  set(kind, { items: [...saved, ...store(kind).items.filter((i) => !ids.has(i.id))] });
  return saved;
}

export async function deleteItem(kind, id) {
  const before = store(kind).items;
  set(kind, { items: before.filter((i) => i.id !== id) });
  try {
    await api(`/api/items/${kind}/${id}`, { method: "DELETE" });
  } catch (err) {
    set(kind, { items: before });
    throw err;
  }
}

export function resetItems() {
  for (const kind of Object.keys(stores)) delete stores[kind];
  listeners.forEach((l) => l());
}
