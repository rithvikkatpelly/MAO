import { CalendarClock, CircleAlert, CircleCheck, CircleX, ListChecks, X } from "lucide-react";
import { hookScore, prePublishChecklist } from "../../lib/quality";
import Popover from "../Popover";

const STATUS = {
  pass: { icon: CircleCheck, className: "text-emerald-500" },
  warn: { icon: CircleAlert, className: "text-amber-500" },
  fail: { icon: CircleX, className: "text-red-500" },
};

function scoreTone(score) {
  return score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-amber-400" : "bg-red-500";
}

// Hook score and pre-publish checklist, opened from the editor's top bar.
export function ChecklistButton({ project }) {
  const checks = prePublishChecklist(project);
  const hook = hookScore(project.slides[0]?.headline);
  const failing = checks.filter((c) => c.status !== "pass").length;

  return (
    <Popover
      width="w-96"
      trigger={({ toggle }) => (
        <button className="btn btn-ghost" onClick={toggle} title="Pre-publish checklist">
          <ListChecks size={16} />
          <span className="hidden lg:inline">Check</span>
          <span className={`rounded-full px-1.5 text-[11px] font-semibold text-white ${failing ? "bg-amber-500" : "bg-emerald-500"}`}>{failing || "OK"}</span>
        </button>
      )}
    >
      <div className="flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-paper">
          <span className="text-xl font-semibold tabular-nums text-ink">{hook.score}</span>
          <span className={`absolute right-1 bottom-1 h-3 w-3 rounded-full ring-2 ring-white ${scoreTone(hook.score)}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Hook score</p>
          <p className="truncate text-xs text-muted">"{project.slides[0]?.headline || "No headline yet"}"</p>
        </div>
      </div>
      {(hook.tips.length > 0 || hook.good.length > 0) && (
        <ul className="mt-3 space-y-1 text-xs">
          {hook.good.map((g) => (
            <li key={g} className="flex gap-1.5 text-emerald-700">
              <CircleCheck size={13} className="mt-px shrink-0" /> {g}
            </li>
          ))}
          {hook.tips.map((t) => (
            <li key={t} className="flex gap-1.5 text-muted">
              <CircleAlert size={13} className="mt-px shrink-0 text-amber-500" /> {t}
            </li>
          ))}
        </ul>
      )}
      <div className="my-4 h-px bg-line" />
      <p className="mb-2 text-xs font-semibold tracking-wide text-ink uppercase">Before you post</p>
      <ul className="space-y-2">
        {checks.map((c) => {
          const { icon: Icon, className } = STATUS[c.status];
          return (
            <li key={c.id} className="flex gap-2.5 text-sm">
              <Icon size={16} className={`mt-0.5 shrink-0 ${className}`} />
              <span>
                <span className="block text-ink">{c.label}</span>
                <span className="block text-xs text-subtle">{c.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatSchedule(iso) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Pick when this post goes out; it then shows on the calendar.
export function ScheduleButton({ project, onChange }) {
  const scheduled = project.scheduledAt;
  return (
    <Popover
      width="w-72"
      trigger={({ toggle }) => (
        <button className={`btn ${scheduled ? "btn-secondary" : "btn-ghost"}`} onClick={toggle} title="Schedule">
          <CalendarClock size={16} />
          <span className="hidden xl:inline">{scheduled ? formatSchedule(scheduled) : "Schedule"}</span>
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <p className="text-sm font-semibold text-ink">Schedule this post</p>
          <p className="mt-0.5 text-xs text-subtle">It shows on your calendar. Aurea does not post it for you.</p>
          <input
            type="datetime-local"
            className="input mt-3"
            value={toLocalInput(scheduled)}
            onChange={(e) => onChange({ scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
          />
          <div className="mt-3 flex justify-between">
            {scheduled ? (
              <button
                className="btn btn-ghost h-8 px-2 text-xs"
                onClick={() => {
                  onChange({ scheduledAt: null });
                  close();
                }}
              >
                <X size={13} /> Unschedule
              </button>
            ) : (
              <span />
            )}
            <button className="btn btn-primary h-8 px-3 text-xs" onClick={close}>
              Done
            </button>
          </div>
        </div>
      )}
    </Popover>
  );
}
