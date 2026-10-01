import { useState } from "react";
import { Loader2, RefreshCw, Scissors, Sparkles, Zap } from "lucide-react";
import { ai, projectForAI } from "../../lib/api";
import { useToast } from "../Toast";

const ACTIONS = [
  { id: "rewrite", label: "Rewrite", icon: RefreshCw },
  { id: "shorten", label: "Shorten", icon: Scissors },
  { id: "punchier", label: "Punchier", icon: Zap },
  { id: "hooks", label: "3 hooks", icon: Sparkles },
];

// Per-slide AI actions. Results apply as one undoable change.
export default function SlideAI({ project, index, onApply }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [hooks, setHooks] = useState(null);
  const slide = project.slides[index];
  const position = index === 0 ? "first" : index === project.slides.length - 1 ? "last" : "middle";

  async function run(action) {
    setBusy(action);
    setHooks(null);
    try {
      const result = await ai.slide({
        action,
        slide: { kicker: slide.kicker ?? "", headline: slide.headline ?? "", body: slide.body ?? "" },
        position,
        project: projectForAI(project),
      });
      if (action === "hooks") setHooks(result.hooks);
      else onApply({ headline: result.headline, body: result.body });
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="field-label">AI assist</p>
      <div className="grid grid-cols-4 gap-1.5">
        {ACTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            disabled={!!busy}
            onClick={() => run(id)}
            className="flex h-14 flex-col items-center justify-center gap-1 rounded-lg border border-line bg-white text-[11px] font-medium text-muted transition hover:border-ink/25 hover:text-ink disabled:opacity-50"
          >
            {busy === id ? <Loader2 size={15} className="animate-spin text-accent" /> : <Icon size={15} />}
            {label}
          </button>
        ))}
      </div>
      {busy && <p className="mt-2 text-xs text-subtle">Working on it. This takes a few seconds on the local model.</p>}
      {hooks && (
        <div className="animate-fade-in mt-3 space-y-1.5">
          {hooks.map((hook) => (
            <button
              key={hook}
              type="button"
              onClick={() => {
                onApply({ headline: hook });
                setHooks(null);
              }}
              className="block w-full rounded-lg border border-line bg-paper px-3 py-2 text-left text-sm text-ink transition hover:border-ink/25 hover:bg-white"
            >
              {hook}
            </button>
          ))}
          <p className="text-xs text-subtle">Click a hook to use it as this slide's headline.</p>
        </div>
      )}
    </div>
  );
}
