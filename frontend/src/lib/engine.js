import { useSyncExternalStore } from "react";
import { checkHealth } from "./api";

// One shared poller for the AI engine's status, however many components ask.
let status = { state: "checking" };
const listeners = new Set();
let timer = null;

async function poll() {
  const result = await checkHealth();
  status = result.online ? { state: "online", model: result.model } : { state: "offline" };
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  if (!timer) {
    poll();
    timer = setInterval(poll, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useEngineStatus() {
  return useSyncExternalStore(subscribe, () => status);
}

export const refreshEngineStatus = poll;
