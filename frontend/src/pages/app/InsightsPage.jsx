import { useMemo, useRef, useState } from "react";
import { ChartColumn, Download, FileUp, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useToast } from "../../components/Toast";
import { SAMPLE_CSV, engagementRate, metricsFromCsv } from "../../lib/csv";
import { deleteItem, saveItem, saveItems, useItems } from "../../lib/items";
import { useProjects } from "../../lib/storage";

const PLATFORM_OPTIONS = ["LinkedIn", "Instagram", "X", "Threads", "TikTok", "YouTube", "Facebook"];
const NUMBER_FIELDS = ["impressions", "likes", "comments", "shares", "saves", "clicks"];
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const compact = (n) => new Intl.NumberFormat(undefined, { notation: "compact" }).format(n);

function Stat({ label, value, hint }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-subtle">{hint}</p>}
    </div>
  );
}

function ImportCard() {
  const toast = useToast();
  const input = useRef(null);
  const [platform, setPlatform] = useState("LinkedIn");
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  async function read(file) {
    if (!file) return;
    try {
      setPending({ name: file.name, rows: metricsFromCsv(await file.text(), platform) });
    } catch (err) {
      toast(err.message, { tone: "error" });
    }
    input.current.value = "";
  }

  async function confirm() {
    setBusy(true);
    try {
      for (let i = 0; i < pending.rows.length; i += 500) await saveItems("metric", pending.rows.slice(i, i + 500));
      toast(`${pending.rows.length} posts imported`);
      setPending(null);
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  function downloadSample() {
    const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "aurea-metrics-template.csv" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-ink">Import from a CSV</h2>
      <p className="mt-0.5 text-xs text-subtle">Export post analytics from LinkedIn, X, or Instagram, or use our template. Columns are matched automatically.</p>
      {pending ? (
        <div className="mt-4 rounded-lg bg-paper p-3">
          <p className="text-sm text-ink">
            <span className="font-medium">{pending.rows.length} posts</span> found in {pending.name}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {pending.rows.slice(0, 3).map((r, i) => (
              <li key={i} className="truncate">
                {r.posted_at || "No date"} · {r.platform} · {r.title || "Untitled"} · {compact(r.impressions)} impressions
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary flex-1" onClick={confirm} disabled={busy}>
              {busy && <Loader2 size={14} className="animate-spin" />} Import
            </button>
            <button className="btn btn-ghost" onClick={() => setPending(null)}>
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <label className="field-label" htmlFor="import-platform">
            Platform, if the file has no platform column
          </label>
          <select id="import-platform" className="input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PLATFORM_OPTIONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <button className="btn btn-secondary w-full" onClick={() => input.current?.click()}>
            <FileUp size={14} /> Choose CSV file
          </button>
          <button className="btn btn-ghost w-full text-xs" onClick={downloadSample}>
            <Download size={13} /> Download the template
          </button>
          <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => read(e.target.files?.[0])} />
        </div>
      )}
    </div>
  );
}

function AddResult() {
  const toast = useToast();
  const projects = useProjects();
  const empty = { platform: "LinkedIn", posted_at: new Date().toISOString().slice(0, 10), title: "", project_id: "", impressions: "", likes: "", comments: "", shares: "", saves: "", clicks: "" };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  async function save(e) {
    e.preventDefault();
    const project = projects.find((p) => p.id === form.project_id);
    try {
      await saveItem("metric", {
        ...form,
        title: form.title || project?.title || "",
        ...Object.fromEntries(NUMBER_FIELDS.map((k) => [k, Math.max(0, Number(form[k]) || 0)])),
      });
      setForm(empty);
      setOpen(false);
      toast("Result saved");
    } catch (err) {
      toast(err.message, { tone: "error" });
    }
  }

  if (!open)
    return (
      <button className="btn btn-secondary w-full" onClick={() => setOpen(true)}>
        <Plus size={14} /> Log a post's results
      </button>
    );

  return (
    <form onSubmit={save} className="card space-y-2 p-5">
      <h2 className="text-sm font-semibold text-ink">Log results</h2>
      <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} aria-label="Project">
        <option value="">Not from Aurea, or pick a project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
      {!form.project_id && <input className="input" placeholder="Post title or first line" maxLength={300} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}
      <div className="flex gap-2">
        <select className="input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} aria-label="Platform">
          {PLATFORM_OPTIONS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <input type="date" className="input" value={form.posted_at} onChange={(e) => setForm({ ...form, posted_at: e.target.value })} aria-label="Posted on" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {NUMBER_FIELDS.map((k) => (
          <input key={k} className="input" inputMode="numeric" placeholder={k[0].toUpperCase() + k.slice(1)} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value.replace(/\D/g, "") })} aria-label={k} />
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button className="btn btn-primary flex-1">Save</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function InsightsPage() {
  const toast = useToast();
  const { status, items } = useItems("metric");

  const summary = useMemo(() => {
    const withReach = items.filter((m) => m.impressions > 0);
    const avg = withReach.length ? withReach.reduce((s, m) => s + engagementRate(m), 0) / withReach.length : 0;
    const byPlatform = {};
    withReach.forEach((m) => (byPlatform[m.platform] ??= []).push(engagementRate(m)));
    const best = Object.entries(byPlatform)
      .map(([p, rates]) => [p, rates.reduce((a, b) => a + b, 0) / rates.length])
      .sort((a, b) => b[1] - a[1])[0];
    const top = [...withReach].sort((a, b) => engagementRate(b) - engagementRate(a)).slice(0, 5);
    return { avg, best, top, impressions: items.reduce((s, m) => s + m.impressions, 0) };
  }, [items]);

  const sorted = useMemo(() => [...items].sort((a, b) => (b.posted_at || "").localeCompare(a.posted_at || "")), [items]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Insights</h1>
      <p className="mt-1 text-sm text-muted">Bring in how your posts performed. Your best posts teach the AI what works for your audience.</p>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Posts tracked" value={items.length} />
        <Stat label="Impressions" value={compact(summary.impressions)} />
        <Stat label="Avg. engagement" value={pct(summary.avg)} hint="Likes, comments, shares, and saves per impression" />
        <Stat label="Best platform" value={summary.best?.[0] ?? "None yet"} hint={summary.best ? `${pct(summary.best[1])} engagement` : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {summary.top.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-accent" />
                <h2 className="text-sm font-semibold text-ink">What the AI learns from</h2>
              </div>
              <p className="mt-0.5 text-xs text-subtle">Your top posts by engagement are shared with the writing agent as examples of what performs.</p>
              <ol className="mt-3 space-y-2">
                {summary.top.map((m, i) => (
                  <li key={m.id} className="flex items-center gap-3 text-sm">
                    <span className="w-4 text-xs font-semibold text-accent">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{m.title || "Untitled post"}</span>
                    <span className="text-xs text-subtle">{m.platform}</span>
                    <span className="w-14 text-right text-xs font-semibold tabular-nums text-ink">{pct(engagementRate(m))}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="card overflow-hidden">
            {status === "loading" ? (
              <div className="flex justify-center py-16 text-subtle">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <ChartColumn size={20} className="text-subtle" />
                <p className="mt-3 text-sm font-medium text-ink">No results yet</p>
                <p className="mt-1 max-w-sm text-xs text-muted">Import a CSV or log a post's numbers to see what works.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-paper text-left text-xs text-muted">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Post</th>
                      <th className="px-2 py-2.5 font-medium">Platform</th>
                      <th className="px-2 py-2.5 text-right font-medium">Impressions</th>
                      <th className="px-2 py-2.5 text-right font-medium">Likes</th>
                      <th className="px-2 py-2.5 text-right font-medium">Comments</th>
                      <th className="px-2 py-2.5 text-right font-medium">Engagement</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {sorted.map((m) => (
                      <tr key={m.id} className="group">
                        <td className="max-w-64 px-4 py-2.5">
                          <p className="truncate text-ink">{m.title || "Untitled post"}</p>
                          <p className="text-xs text-subtle">{m.posted_at || "No date"}</p>
                        </td>
                        <td className="px-2 py-2.5 text-muted">{m.platform}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{compact(m.impressions)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{compact(m.likes)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{compact(m.comments)}</td>
                        <td className="px-2 py-2.5 text-right font-medium tabular-nums">{m.impressions ? pct(engagementRate(m)) : "n/a"}</td>
                        <td className="pr-3">
                          <button className="text-subtle opacity-0 group-hover:opacity-100 hover:text-red-600" onClick={() => deleteItem("metric", m.id).catch((err) => toast(err.message, { tone: "error" }))} aria-label="Delete row">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <ImportCard />
          <AddResult />
        </aside>
      </div>
    </div>
  );
}
