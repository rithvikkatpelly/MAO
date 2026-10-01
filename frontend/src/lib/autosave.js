import { useCallback, useEffect, useRef, useState } from "react";
import { saveProject } from "./storage";

// Debounced autosave for an editor's project state. Flushes on unmount and before
// the tab closes; a failed save is retried with the next edit or flush.
export function useAutosave(project, initial) {
  const [saveState, setSaveState] = useState("saved");
  const pending = useRef(null);

  const flush = useCallback((options) => {
    const current = pending.current;
    if (!current) return;
    pending.current = null;
    saveProject(current, options).then((ok) => {
      if (!ok && !pending.current) pending.current = current;
      if (!pending.current || !ok) setSaveState(ok ? "saved" : "error");
    });
  }, []);

  useEffect(() => {
    if (project === initial) return;
    pending.current = project;
    setSaveState("saving");
    const timer = setTimeout(flush, 500);
    return () => clearTimeout(timer);
  }, [project, initial, flush]);

  useEffect(() => {
    const onUnload = () => flush({ keepalive: true });
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      flush();
    };
  }, [flush]);

  return { saveState, flush };
}
