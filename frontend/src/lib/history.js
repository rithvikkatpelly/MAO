import { useCallback, useRef, useState } from "react";

const LIMIT = 100;
const COALESCE_MS = 800;

// State with undo/redo. Consecutive updates that share a `group` key within
// COALESCE_MS (e.g. typing in one field) collapse into a single undo step.
export function useUndoable(initial) {
  const [history, setHistory] = useState({ past: [], present: initial, future: [] });
  const last = useRef({ group: null, at: 0 });

  const set = useCallback((updater, group = null) => {
    setHistory((h) => {
      const next = typeof updater === "function" ? updater(h.present) : updater;
      if (next === h.present) return h;
      const now = Date.now();
      const coalesce = group && last.current.group === group && now - last.current.at < COALESCE_MS;
      last.current = { group, at: now };
      return {
        past: coalesce ? h.past : [...h.past, h.present].slice(-LIMIT),
        present: next,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    last.current = { group: null, at: 0 };
    setHistory((h) =>
      h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1), future: [h.present, ...h.future] } : h,
    );
  }, []);

  const redo = useCallback(() => {
    last.current = { group: null, at: 0 };
    setHistory((h) =>
      h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h,
    );
  }, []);

  return {
    state: history.present,
    set,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
