import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore, CalendarPlus, Lightbulb, Loader2, MoreHorizontal, Plus, Radar, Trash2, WandSparkles } from "lucide-react";
import { Menu } from "../../components/Menu";
import ResearchHistory from "../../components/ResearchHistory";
import { Segmented, Toggle } from "../../components/controls";
import { useToast } from "../../components/Toast";
import { trendWatch } from "../../lib/api";
import { deleteItem, loadItems, saveItem, useItems } from "../../lib/items";
import { relativeTime } from "../../lib/time";

const SOURCE_LABELS = { research: "Research", trend: "Trend watch", plan: "Week plan", manual: "Added by you", series: "Series" };
const STATUS_FILTERS = [
  { value: "new", label: "To do" },
  { value: "used", label: "Used" },
  { value: "archived", label: "Archived" },
];

function TrendWatch() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    trendWatch.get().then(setSettings).catch(() => setSettings({ enabled: false, frequency: "weekly", topic: "", default_topic: "" }));
  }, []);

  async function save(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      setSettings(await trendWatch.save({ enabled: next.enabled, frequency: next.frequency, topic: next.topic }));
    } catch (err) {
      toast(err.message, { tone: "error" });
    }
  }

  async function runNow() {
    setRunning(true);
    try {
      const { ideas } = await trendWatch.run();
      await loadItems("idea", { force: true });
      setSettings(await trendWatch.get());
      toast(`${ideas.length} fresh ideas added`);
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setRunning(false);
    }
  }

  if (!settings) return <div className="card h-40 animate-pulse" />;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Radar size={16} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-ink">Trend watch</h2>
          <p className="text-xs text-subtle">Researches your niche on a schedule and adds ideas here.</p>
        </div>
      </div>
      <div className="mt-4 divide-y divide-line">
        <Toggle label="Watch my niche" checked={settings.enabled} onChange={(enabled) => save({ enabled })} />
      </div>
      <div className="mt-3 space-y-3">
        <div>
          <label className="field-label" htmlFor="trend-topic">
            Topic
          </label>
          <input
            id="trend-topic"
            className="input"
            maxLength={200}
            placeholder={settings.default_topic || "Your niche, for example: personal finance for freelancers"}
            defaultValue={settings.topic}
            onBlur={(e) => e.target.value !== settings.topic && save({ topic: e.target.value })}
          />
          {!settings.topic && settings.default_topic && <p className="mt-1 text-xs text-subtle">Using your niche: {settings.default_topic}</p>}
        </div>
        <div>
          <p className="field-label">How often</p>
          <Segmented
            size="sm"
            value={settings.frequency}
            onChange={(frequency) => save({ frequency })}
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
            ]}
          />
        </div>
        <button className="btn btn-secondary w-full" onClick={runNow} disabled={running}>
          {running ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
          {running ? "Researching, about a minute" : "Run now"}
        </button>
        {settings.last_run_at && (
          <p className="text-xs text-subtle">
            Last run {relativeTime(settings.last_run_at)}: {settings.last_status}
          </p>
        )}
        <p className="text-xs text-subtle">Scheduled runs happen while the Aurea backend is running.</p>
      </div>
    </div>
  );
}

function AddIdea() {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [angle, setAngle] = useState("");

  async function add(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await saveItem("idea", { title: title.trim(), angle: angle.trim(), source: "manual", status: "new" });
      setTitle("");
      setAngle("");
    } catch (err) {
      toast(err.message, { tone: "error" });
    }
  }

  return (
    <form onSubmit={add} className="card flex flex-col gap-2 p-4 sm:flex-row">
      <input className="input sm:flex-1" placeholder="New idea" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className="input sm:flex-[1.4]" placeholder="Angle or notes (optional)" maxLength={300} value={angle} onChange={(e) => setAngle(e.target.value)} />
      <button className="btn btn-primary" disabled={!title.trim()}>
        <Plus size={15} /> Add
      </button>
    </form>
  );
}

export default function IdeasPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { status, items } = useItems("idea");
  const [filter, setFilter] = useState("new");
  const [source, setSource] = useState("all");
  const [tab, setTab] = useState("backlog");

  const visible = useMemo(
    () => items.filter((i) => (i.status ?? "new") === filter && (source === "all" || i.source === source)),
    [items, filter, source],
  );
  const sources = [...new Set(items.map((i) => i.source))];

  const update = (idea, patch) => saveItem("idea", { ...idea, ...patch }).catch((err) => toast(err.message, { tone: "error" }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Ideas</h1>
        <p className="mt-1 text-sm text-muted">Your backlog: saved research angles, trend watch finds, week plans, and your own notes.</p>
      </div>

      <div className="mt-6 w-80">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "backlog", label: "Backlog" },
            { value: "history", label: "Research history" },
          ]}
        />
      </div>

      {tab === "history" ? (
        <div className="mt-6 max-w-3xl">
          <ResearchHistory />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <AddIdea />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="sm:w-72">
                <Segmented size="sm" value={filter} onChange={setFilter} options={STATUS_FILTERS} />
              </div>
              {sources.length > 1 && (
                <select className="input sm:w-48" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by source">
                  <option value="all">All sources</option>
                  {sources.map((s) => (
                    <option key={s} value={s}>
                      {SOURCE_LABELS[s] ?? s}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {status === "loading" ? (
              <div className="flex justify-center py-16 text-subtle">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
                <Lightbulb size={20} className="text-subtle" />
                <p className="mt-3 text-sm font-medium text-ink">{filter === "new" ? "No ideas waiting" : "Nothing here yet"}</p>
                <p className="mt-1 max-w-sm text-xs text-muted">Save angles you did not use when researching, turn on trend watch, or plan your week from the calendar.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {visible.map((idea) => (
                  <li key={idea.id} className="card flex items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{idea.title}</p>
                      {idea.angle && <p className="mt-0.5 text-sm text-muted">{idea.angle}</p>}
                      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-subtle">
                        <span className="rounded bg-paper px-1.5 py-0.5">{SOURCE_LABELS[idea.source] ?? idea.source}</span>
                        {idea.planned_for && (
                          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-accent">
                            Planned {new Date(`${idea.planned_for.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                        )}
                        <span>Added {relativeTime(idea.createdAt ?? idea.updatedAt)}</span>
                      </p>
                    </div>
                    {filter !== "used" && (
                      <button className="btn btn-secondary h-8 shrink-0 px-2.5 text-xs" onClick={() => navigate("/app/new", { state: { idea, kind: idea.kind && idea.kind !== "text" ? idea.kind : undefined } })}>
                        <WandSparkles size={13} /> Create
                      </button>
                    )}
                    <Menu
                      width="w-52"
                      trigger={({ toggle }) => (
                        <button className="btn btn-ghost btn-icon shrink-0" onClick={toggle} aria-label="Idea actions">
                          <MoreHorizontal size={16} />
                        </button>
                      )}
                      items={[
                        {
                          label: "Plan for tomorrow",
                          icon: CalendarPlus,
                          onClick: () => update(idea, { planned_for: new Date(Date.now() + 86400000).toISOString().slice(0, 10) }),
                        },
                        idea.status === "archived"
                          ? { label: "Restore", icon: ArchiveRestore, onClick: () => update(idea, { status: "new" }) }
                          : { label: "Archive", icon: Archive, onClick: () => update(idea, { status: "archived" }) },
                        "divider",
                        { label: "Delete", icon: Trash2, danger: true, onClick: () => deleteItem("idea", idea.id).catch((err) => toast(err.message, { tone: "error" })) },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className="space-y-4">
            <TrendWatch />
          </aside>
        </div>
      )}
    </div>
  );
}
