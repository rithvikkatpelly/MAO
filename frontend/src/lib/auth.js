import { useSyncExternalStore } from "react";
import { api, ApiError } from "./api";

// Session state for the whole app. status: loading | signed-in | signed-out | error
let state = { status: "loading", user: null, profile: null };
const listeners = new Set();
let started = false;

function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  if (!started) {
    started = true;
    loadSession();
  }
  return () => listeners.delete(listener);
}

export function useAuth() {
  return useSyncExternalStore(subscribe, () => state);
}

export async function loadSession() {
  try {
    const me = await api("/api/auth/me");
    set({ status: "signed-in", user: me.user, profile: me.profile });
  } catch (err) {
    const signedOut = err instanceof ApiError && (err.status === 401 || err.status === 503);
    set({ status: signedOut ? "signed-out" : "error", user: null, profile: null });
  }
}

let configPromise = null;
export function getAuthConfig() {
  configPromise ??= api("/api/auth/config").catch((err) => {
    configPromise = null;
    throw err;
  });
  return configPromise;
}

export async function signInWithGoogle(credential) {
  await api("/api/auth/google", { method: "POST", body: { credential } });
  await loadSession();
}

export async function devLogin() {
  await api("/api/auth/dev-login", { method: "POST" });
  await loadSession();
}

export async function signOut() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    set({ status: "signed-out", user: null, profile: null });
  }
}

// Saves part of the profile ({ brand?, social?, onboarded? }) and mirrors it locally.
export async function updateProfile(patch) {
  await api("/api/profile", { method: "PUT", body: patch });
  set({
    profile: {
      ...state.profile,
      ...(patch.brand ? { brand: patch.brand } : {}),
      ...(patch.social ? { social: patch.social } : {}),
      ...(patch.onboarded !== undefined ? { onboarded: patch.onboarded } : {}),
    },
  });
}
