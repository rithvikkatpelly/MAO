import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, GripVertical, Lightbulb, Loader2, Plus, Repeat2, Sparkles, Trash2 } from "lucide-react";
import { Segmented, Toggle } from "../../components/controls";
import { useToast } from "../../components/Toast";
import { ai } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { KINDS, TEXT_FORMATS } from "../../lib/formats";
import { deleteItem, saveItem, saveItems, useItems } from "../../lib/items";
import { saveProject, useProjects } from "../../lib/storage";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const POSTS_PER_WEEK = { Daily: 7, "A few times a week": 4, Weekly: 2, "A few times a month": 1 };

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const weekdayIndex = (d) => (d.getDay() + 6) % 7; // Monday = 0

function startOfWeek(d) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - weekdayIndex(s));
  return s;
}

function addDays(d, n) {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function visibleDays(anchor, view) {
  if (view === "week") return Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const days = [];
  for (let d = start; d <= last || weekdayIndex(d) !== 0; d = addDays(d, 1)) days.push(d);
  return days;
}

function kindLabel(project) {
  if (project.kind === "text") return TEXT_FORMATS[project.textFormat]?.label ?? "Text";
  return KINDS[project.kind]?.label ?? "Post";
}

function Chip({ drag, children, className = "", onClick }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify(drag));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onClick}
      className={`group flex cursor-grab items-start gap-1 rounded-md border px-1.5 py-1 text-[11px] leading-tight active:cursor-grabbing ${className}`}
    >
      <GripVertical size={11} className="mt-px shrink-0 opacity-30 group-hover:opacity-70" />
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

function SeriesManager() {
  const toast = useToast();
  const { items: series } = useItems("series");
  const [draft, setDraft] = useState({ name: "", weekday: 1, kind: "carousel", prompt: "" });

  async function add(e) {
    e.preventDefault();
    try {
      await saveItem("series", { ...draft, name: draft.name.trim(), template: "auto", slide_count: 6, active: true });
      setDraft({ name: "", weekday: 1, kind: "carousel", prompt: "" });
    } catch (err) {
      toast(err.message, { tone: "error" });
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Repeat2 size={16} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-ink">Series</h2>
          <p className="text-xs text-subtle">Recurring formats like Tip Tuesday.</p>
        </div>
      </div>
      {series.length > 0 && (
        <ul className="mt-4 space-y-2">
          {series.map((s) => (
            <li key={s.id} className="rounded-lg border border-line p-2.5">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{s.name}</p>
                <button className="text-subtle hover:text-red-600" onClick={() => deleteItem("series", s.id).catch((err) => toast(err.message, { tone: "error" }))} aria-label={`Delete ${s.name}`}>
                  <Trash2 size={13} />
                </button>
              </div>
              <p className="text-xs text-subtle">
                Every {WEEKDAY_NAMES[s.weekday]}, {KINDS[s.kind]?.label.toLowerCase() ?? "post"}
              </p>
              <Toggle label="Active" checked={s.active} onChange={(active) => saveItem("series", { ...s, active }).catch((err) => toast(err.message, { tone: "error" }))} />
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-4 space-y-2 border-t border-line pt-4">
        <input className="input" placeholder="Series name, e.g. Tip Tuesday" maxLength={60} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <div className="flex gap-2">
          <select className="input" value={draft.weekday} onChange={(e) => setDraft({ ...draft, weekday: Number(e.target.value) })} aria-label="Weekday">
            {WEEKDAY_NAMES.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          <select className="input" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} aria-label="Format">
            {Object.values(KINDS).map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <textarea className="input resize-none" rows={2} maxLength={500} placeholder="Theme, e.g. one practical pricing tip for freelancers" value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} />
        <button className="btn btn-secondary w-full" disabled={!draft.name.trim()}>
          <Plus size={14} /> Add series
        </button>
      </form>
    </div>
  );
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const projects = useProjects();
  const { items: ideas } = useItems("idea");
  const { items: series } = useItems("series");
  const [view, setView] = useState("week");
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [over, setOver] = useState(null);
  const [planning, setPlanning] = useState(false);

  const days = useMemo(() => visibleDays(anchor, view), [anchor, view]);
  const today = dayKey(new Date());

  const byDay = useMemo(() => {
    const map = {};
    const push = (key, entry) => (map[key] ??= []).push(entry);
    projects.filter((p) => p.scheduledAt).forEach((p) => push(dayKey(new Date(p.scheduledAt)), { type: "project", item: p }));
    ideas.filter((i) => i.planned_for && i.status === "new").forEach((i) => push(i.planned_for.slice(0, 10), { type: "idea", item: i }));
    return map;
  }, [projects, ideas]);

  const unscheduledProjects = projects.filter((p) => !p.scheduledAt).slice(0, 12);
  const backlog = ideas.filter((i) => i.status === "new" && !i.planned_for).slice(0, 12);

  function move(delta) {
    setAnchor((a) => (view === "week" ? addDays(a, delta * 7) : new Date(a.getFullYear(), a.getMonth() + delta, 1)));
  }

  function drop(e, day) {
    e.preventDefault();
    setOver(null);
    let payload;
    try {
      payload = JSON.parse(e.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }
    if (payload.type === "project") {
      const project = projects.find((p) => p.id === payload.id);
      if (!project) return;
      let scheduledAt = null;
      if (day) {
        const prev = project.scheduledAt ? new Date(project.scheduledAt) : null;
        const at = new Date(day);
        at.setHours(prev ? prev.getHours() : 9, prev ? prev.getMinutes() : 0, 0, 0);
        scheduledAt = at.toISOString();
      }
      saveProject({ ...project, scheduledAt }).then((ok) => !ok && toast("Could not save the schedule", { tone: "error" }));
    } else if (payload.type === "idea") {
      const idea = ideas.find((i) => i.id === payload.id);
      if (idea) saveItem("idea", { ...idea, planned_for: day ? dayKey(day) : "" }).catch((err) => toast(err.message, { tone: "error" }));
    }
  }

  const dropProps = (day) => ({
    onDragOver: (e) => {
      e.preventDefault();
      setOver(day ? dayKey(day) : "none");
    },
    onDragLeave: () => setOver(null),
    onDrop: (e) => drop(e, day),
  });

  async function planWeek() {
    setPlanning(true);
    try {
      const start = view === "week" ? anchor : startOfWeek(new Date());
      const posts = POSTS_PER_WEEK[profile?.social?.frequency] ?? 3;
      const { items } = await ai.planWeek({ start: dayKey(start < new Date() ? new Date() : start), days: 7, posts });
      await saveItems(
        "idea",
        items.map((i) => ({ title: i.title, angle: i.angle, source: "plan", status: "new", planned_for: i.date, kind: i.kind })),
      );
      toast(`${items.length} posts planned. Drag them to adjust.`);
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setPlanning(false);
    }
  }

  const title =
    view === "week"
      ? `${anchor.toLocaleDateString(undefined, { month: "short", day: "numeric" })} to ${addDays(anchor, 6).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
      : anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Calendar</h1>
          <p className="mt-1 text-sm text-muted">Drag posts and ideas onto a day. Series show up on their weekday.</p>
        </div>
        <button className="btn btn-accent" onClick={planWeek} disabled={planning}>
          {planning ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {planning ? "Planning your week" : "Plan my week"}
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button className="btn btn-secondary btn-icon h-9 w-9" onClick={() => move(-1)} aria-label="Previous">
          <ChevronLeft size={16} />
        </button>
        <button className="btn btn-secondary btn-icon h-9 w-9" onClick={() => move(1)} aria-label="Next">
          <ChevronRight size={16} />
        </button>
        <button className="btn btn-ghost" onClick={() => setAnchor(view === "week" ? startOfWeek(new Date()) : new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
          Today
        </button>
        <h2 className="ml-1 text-sm font-semibold text-ink">{title}</h2>
        <div className="ml-auto w-40">
          <Segmented
            size="sm"
            value={view}
            onChange={(v) => {
              setView(v);
              setAnchor(v === "week" ? startOfWeek(anchor) : new Date(anchor.getFullYear(), anchor.getMonth(), 1));
            }}
            options={[
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-7 overflow-hidden rounded-2xl border border-line bg-line gap-px">
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-paper px-2 py-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const key = dayKey(day);
              const entries = byDay[key] ?? [];
              const slots = series.filter((s) => s.active && s.weekday === weekdayIndex(day) && key >= today);
              const outside = view === "month" && day.getMonth() !== anchor.getMonth();
              return (
                <div
                  key={key}
                  {...dropProps(day)}
                  className={`flex flex-col gap-1 bg-white p-1.5 transition ${view === "week" ? "min-h-72" : "min-h-28"} ${outside ? "bg-paper/60" : ""} ${over === key ? "bg-accent/5 ring-2 ring-accent ring-inset" : ""}`}
                >
                  <span className={`mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums ${key === today ? "bg-accent font-semibold text-white" : outside ? "text-subtle" : "text-ink"}`}>
                    {day.getDate()}
                  </span>
                  {slots.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => navigate("/app/new", { state: { series: s } })}
                      className="flex items-center gap-1 rounded-md border border-dashed border-accent/40 px-1.5 py-1 text-left text-[11px] text-accent hover:bg-accent/5"
                      title="Create this episode"
                    >
                      <Repeat2 size={11} className="shrink-0" /> <span className="truncate">{s.name}</span>
                    </button>
                  ))}
                  {entries.map(({ type, item }) =>
                    type === "project" ? (
                      <Chip key={item.id} drag={{ type, id: item.id }} className="border-ink/10 bg-ink text-white" onClick={() => navigate(`/app/p/${item.id}`)}>
                        <span className="block truncate font-medium">{item.title}</span>
                        <span className="block text-white/60">
                          {new Date(item.scheduledAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {kindLabel(item)}
                        </span>
                      </Chip>
                    ) : (
                      <Chip key={item.id} drag={{ type, id: item.id }} className="border-line bg-paper text-ink" onClick={() => navigate("/app/new", { state: { idea: item } })}>
                        <span className="flex items-center gap-1">
                          <Lightbulb size={10} className="shrink-0 text-accent" />
                          <span className="truncate">{item.title}</span>
                        </span>
                      </Chip>
                    ),
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div {...dropProps(null)} className={`card p-5 transition ${over === "none" ? "ring-2 ring-accent" : ""}`}>
            <h2 className="text-sm font-semibold text-ink">Not scheduled</h2>
            <p className="text-xs text-subtle">Drag onto a day. Drop here to unschedule.</p>
            <p className="field-label mt-4">Projects</p>
            <div className="space-y-1">
              {unscheduledProjects.length === 0 && <p className="text-xs text-subtle">All projects are scheduled.</p>}
              {unscheduledProjects.map((p) => (
                <Chip key={p.id} drag={{ type: "project", id: p.id }} className="border-line bg-white text-ink">
                  <span className="block truncate font-medium">{p.title}</span>
                  <span className="block text-subtle">{kindLabel(p)}</span>
                </Chip>
              ))}
            </div>
            <p className="field-label mt-4">Ideas</p>
            <div className="space-y-1">
              {backlog.length === 0 && (
                <p className="text-xs text-subtle">
                  No unplanned ideas. <Link to="/app/ideas" className="underline">Open the backlog</Link>
                </p>
              )}
              {backlog.map((i) => (
                <Chip key={i.id} drag={{ type: "idea", id: i.id }} className="border-line bg-paper text-ink">
                  <span className="flex items-center gap-1">
                    <Lightbulb size={10} className="shrink-0 text-accent" />
                    <span className="truncate">{i.title}</span>
                  </span>
                </Chip>
              ))}
            </div>
          </div>
          <SeriesManager />
        </aside>
      </div>
    </div>
  );
}
