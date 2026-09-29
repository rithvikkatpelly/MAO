import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function PipelineProgress({ title, subtitle, steps, progress, startedAt, onCancel }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const done = steps.filter((s) => progress[s.node]?.status === "done").length;
  const running = steps.filter((s) => progress[s.node]?.status === "running").length;
  const percent = Math.round(((done + running * 0.5) / steps.length) * 100);

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>

      <div className="card mt-8 flex flex-col items-center gap-10 p-8 sm:flex-row sm:items-start">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="8" className="stroke-ink/[0.07]" />
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className="stroke-accent transition-[stroke-dashoffset] duration-700 ease-out"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums text-ink">{percent}%</span>
            <span className="text-xs tabular-nums text-subtle">{formatDuration(now - startedAt)}</span>
          </div>
        </div>

        <ol className="w-full">
          {steps.map((step, i) => {
            const state = progress[step.node];
            const status = state?.status ?? "pending";
            const isLast = i === steps.length - 1;
            const elapsed =
              status === "done" ? state.endedAt - state.startedAt : status === "running" ? now - state.startedAt : null;

            return (
              <li key={step.node} className="relative flex gap-4 pb-6 last:pb-0">
                {!isLast && (
                  <span className={`absolute top-8 left-[13px] h-[calc(100%-2rem)] w-px ${status === "done" ? "bg-accent" : "bg-line"}`} />
                )}
                <span
                  className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                    status === "done"
                      ? "border-accent bg-accent text-white"
                      : status === "running"
                        ? "border-accent bg-white text-accent"
                        : "border-line bg-white"
                  }`}
                >
                  {status === "done" && <Check size={14} strokeWidth={3} />}
                  {status === "running" && <Loader2 size={14} className="animate-spin" />}
                </span>

                <div className="flex-1 pt-0.5">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${status === "pending" ? "text-subtle" : "text-ink"}`}>{step.label}</p>
                    {step.parallel && (
                      <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase">In parallel</span>
                    )}
                    {elapsed !== null && <span className="ml-auto text-xs tabular-nums text-subtle">{formatDuration(elapsed)}</span>}
                  </div>
                  <p className={`text-xs ${status === "pending" ? "text-subtle/70" : "text-muted"}`}>{step.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {onCancel && (
        <div className="mt-6 flex justify-center">
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
