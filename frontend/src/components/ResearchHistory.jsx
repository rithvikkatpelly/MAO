import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, BookmarkCheck, ChevronDown, CircleCheck, ExternalLink, History, Loader2, RefreshCw, Search, Trash2, WandSparkles } from "lucide-react";
import { KINDS } from "../lib/formats";
import { deleteItem, saveItem, useItems } from "../lib/items";
import { relativeTime } from "../lib/time";
import { useToast } from "./Toast";

const PLATFORM_LABELS = { linkedin: "LinkedIn", instagram: "Instagram", x: "X" };

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Run({ run, savedTitles }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const kind = KINDS[run.kind];

  async function save(idea) {
    try {
      await saveItem("idea", { title: idea.title, angle: idea.angle, reason: idea.reason, topic: run.topic, source: "research", status: "new", kind: run.kind || "" });
      toast("Saved to your backlog");
    } catch (err) {
      toast(err.message, { tone: "error" });
    }
  }

  return (
    <li className="card">
      <button type="button" className="flex w-full items-start gap-3 p-4 text-left" onClick={() => setOpen(!open)}>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper text-muted">
          <Search size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{run.topic}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-subtle">
            <span title={new Date(run.createdAt).toLocaleString()}>{relativeTime(run.createdAt)}</span>
            {run.platform && <span className="rounded bg-paper px-1.5 py-0.5">{PLATFORM_LABELS[run.platform] ?? run.platform}</span>}
            {kind && <span className="rounded bg-paper px-1.5 py-0.5">{kind.label}</span>}
            {run.origin === "idea" && <span className="rounded bg-paper px-1.5 py-0.5">From a saved idea</span>}
            <span>
              {run.ideas.length} idea{run.ideas.length === 1 ? "" : "s"}
            </span>
          </span>
          {run.picked && (
            <span className="mt-1.5 flex items-center gap-1 text-xs text-emerald-700">
              <CircleCheck size={12} /> Made into a post: {run.picked}
            </span>
          )}
        </span>
        <ChevronDown size={16} className={`mt-1 shrink-0 text-subtle transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="animate-fade-in space-y-4 border-t border-line p-4">
          <ul className="space-y-2">
            {run.ideas.map((idea) => {
              const picked = idea.title === run.picked;
              const saved = savedTitles.has(idea.title.toLowerCase());
              return (
                <li key={idea.title} className={`flex gap-3 rounded-lg border p-3 ${picked ? "border-emerald-200 bg-emerald-50/50" : "border-line"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                      {picked && <CircleCheck size={14} className="shrink-0 text-emerald-600" />}
                      {idea.title}
                    </span>
                    {idea.angle && <span className="mt-0.5 block text-sm text-muted">{idea.angle}</span>}
                    {idea.reason && <span className="mt-1 block text-xs text-accent">{idea.reason}</span>}
                  </span>
                  <span className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      className="btn btn-secondary h-8 px-2.5 text-xs"
                      onClick={() => navigate("/app/new", { state: { idea: { ...idea, topic: run.topic }, kind: run.kind || undefined } })}
                    >
                      <WandSparkles size={13} /> Create
                    </button>
                    <button type="button" className={`btn h-8 px-2.5 text-xs ${saved ? "text-accent" : "btn-ghost"}`} disabled={saved} onClick={() => save(idea)}>
                      {saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />} {saved ? "Saved" : "Save"}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>

          {run.sources?.length > 0 && (
            <div>
              <p className="field-label">Sources used for "{run.picked}"</p>
              <ol className="space-y-1.5">
                {run.sources.map((s, i) => (
                  <li key={s.url || i} className="flex gap-2 text-xs">
                    <span className="w-4 shrink-0 font-semibold text-accent">{i + 1}</span>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="group min-w-0">
                      <span className="text-ink group-hover:underline">{s.title}</span>{" "}
                      <span className="inline-flex items-center gap-0.5 text-subtle">
                        {domainOf(s.url)} <ExternalLink size={10} />
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => navigate("/app/new", { state: { topic: run.topic, kind: run.kind || undefined } })}>
              <RefreshCw size={14} /> Research again
            </button>
            <button type="button" className="btn btn-ghost ml-auto" onClick={() => deleteItem("research", run.id).catch((err) => toast(err.message, { tone: "error" }))}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// Every research run: the topic, the ideas it suggested, which one became a post, and its sources.
export default function ResearchHistory() {
  const { status, items } = useItems("research");
  const { items: ideas } = useItems("idea");
  const [query, setQuery] = useState("");
  const savedTitles = useMemo(() => new Set(ideas.map((i) => i.title.toLowerCase())), [ideas]);

  const runs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...items]
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .filter((r) => !q || r.topic.toLowerCase().includes(q) || r.ideas.some((i) => i.title.toLowerCase().includes(q)));
  }, [items, query]);

  if (status === "loading")
    return (
      <div className="flex justify-center py-16 text-subtle">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );

  if (!items.length)
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
        <History size={20} className="text-subtle" />
        <p className="mt-3 text-sm font-medium text-ink">No research yet</p>
        <p className="mt-1 max-w-sm text-xs text-muted">Every time you research a topic, the ideas and sources are kept here so you can come back to them.</p>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="relative sm:w-80">
        <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-subtle" />
        <input className="input pl-9" placeholder="Search topics and ideas" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search research history" />
      </div>
      <ul className="space-y-2">
        {runs.map((run) => (
          <Run key={run.id} run={run} savedTitles={savedTitles} />
        ))}
      </ul>
    </div>
  );
}
