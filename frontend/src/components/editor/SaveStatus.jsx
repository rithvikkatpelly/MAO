import { Cloud, CloudOff, Loader2 } from "lucide-react";

export default function SaveStatus({ state }) {
  if (state === "error")
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-red-600">
        <CloudOff size={14} /> Not saved, will retry
      </span>
    );
  return (
    <span className="hidden items-center gap-1.5 text-xs text-subtle sm:flex">
      {state === "saving" ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={14} />}
      {state === "saving" ? "Saving" : "Saved"}
    </span>
  );
}
