import { useCallback, useEffect, useState } from "react";
import { account } from "./api";

// Today's AI usage and limits (backend/api/account.py). Refresh after a run finishes.
export function useUsage() {
  const [usage, setUsage] = useState(null);
  const refresh = useCallback(() => {
    account
      .usage()
      .then(setUsage)
      .catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return [usage, refresh];
}

export function resetTime(usage) {
  if (!usage?.resets_at) return "midnight UTC";
  return new Date(usage.resets_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
