import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  GalleryHorizontalEnd,
  LayoutPanelTop,
  Loader2,
  Minus,
  Plus,
  Presentation,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";
import DesignFrame from "../../components/design/DesignFrame";
import { useToast } from "../../components/Toast";
import { describeError, design } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { DESIGN_FORMAT_ORDER, designProject, useCatalog } from "../../lib/design";
import { insertProject, useBrand } from "../../lib/storage";
import { resetTime, useUsage } from "../../lib/usage";

const FORMAT_ICONS = { carousel: GalleryHorizontalEnd, slides: Presentation, infographic: LayoutPanelTop, flyer: FileText, brochure: BookOpen };
const STEPS = ["Brief", "Topic", "Content", "Style", "Design"];
const UNIT_NOUN = { carousel: "slide", slides: "slide", infographic: "section", flyer: "page", brochure: "panel" };

// ---- small pieces ---------------------------------------------------------------------------

function Stepper({ step }) {
  return (
    <ol className="mb-8 flex flex-wrap items-center gap-2 text-xs">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full font-semibold ${
              i < step ? "bg-accent text-white" : i === step ? "bg-ink text-white" : "bg-ink/[0.06] text-subtle"
            }`}
          >
            {i < step ? <Check size={12} strokeWidth={3} /> : i + 1}
          </span>
          <span className={i === step ? "font-medium text-ink" : "text-subtle"}>{label}</span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-line" />}
        </li>
      ))}
    </ol>
  );
}

function RunProgress({ title, steps, progress, onCancel }) {
  return (
    <div className="card p-6">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Loader2 size={16} className="animate-spin text-accent" /> {title}
      </p>
      {progress.queue?.status === "running" && !steps.some((s) => progress[s.node]) && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{progress.queue.detail}</p>
      )}
      <ol className="mt-4 space-y-2.5">
        {steps.map((s) => {
          const state = progress[s.node];
          return (
            <li key={s.node} className="flex items-center gap-2.5 text-sm">
              {state?.status === "done" ? (
                <Check size={15} className="text-emerald-500" />
              ) : state?.status === "running" ? (
                <Loader2 size={15} className="animate-spin text-accent" />
              ) : (
                <span className="h-[15px] w-[15px] rounded-full border border-line" />
              )}
              <span className={state ? "text-ink" : "text-subtle"}>{s.label}</span>
              {state?.detail && state.status === "running" && <span className="text-xs text-muted">{state.detail}</span>}
            </li>
          );
        })}
      </ol>
      {onCancel && (
        <button type="button" className="btn btn-ghost mt-4" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}

function Warnings({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-2 space-y-1">
      {items.map((w) => (
        <li key={w} className="flex gap-1.5 text-xs text-amber-700">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" /> {w}
        </li>
      ))}
    </ul>
  );
}

const field = "input text-sm";

// ---- content editing ---------------------------------------------------------------------------

function UnitEditor({ format, index, unit, onChange, onDelete, canDelete }) {
  const c = unit.content;
  const set = (patch) => onChange({ ...unit, content: { ...c, ...patch } });
  const setPoint = (i, patch) => set({ points: c.points.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const setNumber = (i, patch) => set({ numbers: c.numbers.map((n, j) => (j === i ? { ...n, ...patch } : n)) });

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-semibold text-white">
          {UNIT_NOUN[format]} {index + 1}
        </span>
        <span className="text-xs text-subtle capitalize">{unit.role}</span>
        {canDelete && (
          <button type="button" className="btn btn-ghost btn-icon ml-auto h-7 w-7" onClick={onDelete} aria-label={`Remove ${UNIT_NOUN[format]} ${index + 1}`}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div className="space-y-2.5">
        <input className={`${field} font-medium`} value={c.headline} maxLength={90} onChange={(e) => set({ headline: e.target.value })} aria-label="Headline" placeholder="Headline" />
        <input className={field} value={c.subtitle} maxLength={150} onChange={(e) => set({ subtitle: e.target.value })} aria-label="Subtitle" placeholder="The point, in one line" />
        {c.points.map((p, i) => (
          <div key={i} className="flex gap-2">
            <input className={`${field} w-36 shrink-0`} value={p.label} maxLength={40} onChange={(e) => setPoint(i, { label: e.target.value })} aria-label={`Point ${i + 1} label`} />
            <input className={field} value={p.text} maxLength={220} onChange={(e) => setPoint(i, { text: e.target.value })} aria-label={`Point ${i + 1}`} />
            <button type="button" className="btn btn-ghost btn-icon h-9 w-9 shrink-0" onClick={() => set({ points: c.points.filter((_, j) => j !== i) })} aria-label={`Remove point ${i + 1}`}>
              <Minus size={13} />
            </button>
          </div>
        ))}
        {c.points.length < 5 && (
          <button type="button" className="btn btn-ghost h-7 px-2 text-xs" onClick={() => set({ points: [...c.points, { label: "", text: "" }] })}>
            <Plus size={12} /> Add a point
          </button>
        )}
        {c.numbers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {c.numbers.map((n, i) => (
              <div key={i} className="flex items-center gap-1 rounded-lg bg-paper p-1">
                <input className="input h-8 w-20 text-sm font-semibold" value={n.value} maxLength={20} onChange={(e) => setNumber(i, { value: e.target.value })} aria-label={`Number ${i + 1}`} />
                <input className="input h-8 w-52 text-xs" value={n.meaning} maxLength={110} onChange={(e) => setNumber(i, { meaning: e.target.value })} aria-label={`What number ${i + 1} measures`} />
                <button type="button" className="btn btn-ghost btn-icon h-7 w-7" onClick={() => set({ numbers: c.numbers.filter((_, j) => j !== i) })} aria-label={`Remove number ${i + 1}`}>
                  <Minus size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {(format === "flyer" || c.details?.length > 0) && (
          <textarea
            className={`${field} min-h-16`}
            value={(c.details ?? []).join("\n")}
            onChange={(e) => set({ details: e.target.value.split("\n").slice(0, 6).map((d) => d.slice(0, 120)) })}
            placeholder="Details, one per line: date, time, place, price, contact"
            aria-label="Details"
          />
        )}
        <input className={field} value={c.takeaway} maxLength={150} onChange={(e) => set({ takeaway: e.target.value })} aria-label="Takeaway" placeholder="Takeaway, one line" />
        {(format === "flyer" || format === "brochure" || c.cta) && (
          <input className={field} value={c.cta} maxLength={140} onChange={(e) => set({ cta: e.target.value })} aria-label="Call to action" placeholder="Call to action" />
        )}
        {format === "slides" && (
          <textarea className={`${field} min-h-16`} value={c.notes} maxLength={600} onChange={(e) => set({ notes: e.target.value })} aria-label="Speaker notes" placeholder="Speaker notes" />
        )}
        {c.visual && <p className="text-xs text-subtle">Visual idea: {c.visual}</p>}
      </div>
      <Warnings items={unit.warnings} />
    </div>
  );
}

// A sample page in a style, built from the creator's own content, for the style picker.
function samplePage(format, unit, meta) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const c = unit?.content ?? { headline: "Your headline", subtitle: "The point of the page", points: [], numbers: [], takeaway: "Your takeaway" };
  const cards = (c.points.length ? c.points : [{ label: "First point", text: "A short line." }, { label: "Second point", text: "Another line." }])
    .slice(0, 2)
    .map((p, i) => `<div class="card${i ? " alt" : ""}"><div class="card-title"><span class="icon sm"><i class="fa-solid fa-${i ? "bolt" : "lightbulb"}"></i></span>${esc(p.label)}</div><div class="card-sub">${esc(p.text)}</div></div>`)
    .join("");
  const chips = c.numbers.length ? `<div class="chips">${c.numbers.slice(0, 3).map((n) => `<span class="chip"><b>${esc(n.value)}</b> ${esc(n.meaning).slice(0, 30)}</span>`).join("")}</div>` : "";
  const body = `<div class="band"><h1>${esc(c.headline)}</h1></div><div class="body"><div class="subtitle">${esc(c.subtitle)}</div><div class="grid-2">${cards}</div>${chips}<div class="quote">${esc(c.takeaway || c.subtitle)}</div></div>`;
  const top = format === "carousel" ? `<div class="topbar"><div class="avatar">${esc((meta.author || "A").slice(0, 1).toUpperCase())}</div><div class="author">${esc(meta.author)}</div><div class="chev">&gt;&gt;&gt;</div></div>` : "";
  const foot = format === "carousel" || format === "slides" ? `<div class="footer">${esc(meta.brand || meta.author)} · 2 / 8</div>` : "";
  const cls = ["page", top && "has-topbar", foot && "has-footer", format === "infographic" && "auto"].filter(Boolean).join(" ");
  return `<div class="${cls}">${top}<div class="content">${body}</div>${foot}</div>`;
}

// ---- the page ------------------------------------------------------------------------------------

export default function DesignStudioPage() {
  const { catalog, error: catalogError } = useCatalog();
  const { user } = useAuth();
  const brand = useBrand();
  const toast = useToast();
  const navigate = useNavigate();
  const [usage, refreshUsage] = useUsage();

  const [step, setStep] = useState(0);
  const [format, setFormat] = useState("carousel");
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState("");
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(8);
  const [topics, setTopics] = useState([]);
  const [chosen, setChosen] = useState(null); // index into topics, or "custom"
  const [customTopic, setCustomTopic] = useState("");
  const [content, setContent] = useState(null); // { title, units, sources }
  const [style, setStyle] = useState("gingham_notebook");
  const [ideas, setIdeas] = useState("");
  const [metaEdits, setMetaEdits] = useState({}); // what the creator typed; defaults come from their account
  const [run, setRun] = useState(null); // { title, steps }
  const [progress, setProgress] = useState({});
  const [designed, setDesigned] = useState([]);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  const meta = { author: metaEdits.author ?? user?.name ?? "", brand: metaEdits.brand ?? brand?.name ?? "" };
  const setMeta = (update) => setMetaEdits((m) => update({ ...meta, ...m }));

  const f = catalog?.formats[format];
  const designs = usage?.buckets?.design;

  function pickFormat(id) {
    setFormat(id);
    setCount(catalog.formats[id].count.default);
  }

  function track(event) {
    if (event.data?.unit && event.node === "content") {
      setContent((c) => {
        const units = [...(c?.units ?? [])];
        units[event.data.index] = event.data.unit;
        return { ...(c ?? {}), units };
      });
    }
    if (event.data?.unit && event.node === "design") {
      setDesigned((d) => {
        const next = [...d];
        next[event.data.index] = event.data.unit;
        return next;
      });
    }
    setProgress((p) => ({ ...p, [event.node]: { status: event.status, detail: event.detail } }));
  }

  async function runStep(config, start) {
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setProgress({});
    setRun(config);
    try {
      return await start(track, controller.signal);
    } catch (err) {
      const message = describeError(err);
      if (message) setError(message);
      return null;
    } finally {
      setRun(null);
      refreshUsage();
    }
  }

  async function findTopics(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    const result = await runStep(
      { title: "Finding topics", steps: [{ node: "safety", label: "Safety check" }, { node: "research", label: "Searching current sources" }, { node: "topics", label: "Suggesting topics" }] },
      (onStep, signal) => design.topics({ query: query.trim(), format, audience: audience.trim() }, onStep, signal),
    );
    if (result) {
      setTopics(result.topics);
      setChosen(0);
      setStep(1);
    }
  }

  const topic = chosen === "custom" ? { title: customTopic.trim(), angle: "" } : topics[chosen];

  async function writeContent() {
    if (!topic?.title) return;
    setContent({ units: [] });
    const result = await runStep(
      {
        title: `Writing your ${f.label.toLowerCase()} ${UNIT_NOUN[format]} by ${UNIT_NOUN[format]}`,
        steps: [
          { node: "safety", label: "Safety check" },
          { node: "research", label: "Researching the topic" },
          { node: "outline", label: "Planning the story" },
          { node: "content", label: `Writing each ${UNIT_NOUN[format]}` },
        ],
      },
      (onStep, signal) => design.content({ query: query.trim(), topic: { title: topic.title, angle: topic.angle ?? "" }, format, count, audience: audience.trim(), notes: notes.trim() }, onStep, signal),
    );
    if (result) {
      setContent(result);
      setStep(2);
    } else setContent(null);
  }

  async function generate() {
    setDesigned([]);
    const units = content.units.map((u) => ({ role: u.role, content: u.content }));
    const result = await runStep(
      { title: `Designing your ${f.label.toLowerCase()}`, steps: [{ node: "safety", label: "Safety check" }, { node: "design", label: `Designing each ${UNIT_NOUN[format]} and checking its layout` }] },
      (onStep, signal) => design.generate({ format, style, title: content.title ?? topic?.title ?? "", design_ideas: ideas.trim(), units, meta }, onStep, signal),
    );
    if (!result) return;
    try {
      const project = insertProject(
        designProject({
          title: content.title,
          format,
          style,
          query,
          topic,
          designIdeas: ideas.trim(),
          meta: result.meta,
          sources: content.sources,
          units: result.units.map((u, i) => ({ ...u, warnings: [...(content.units[i]?.warnings ?? []), ...(u.warnings ?? [])] })),
        }),
      );
      toast(`Your ${f.label.toLowerCase()} is ready`);
      navigate(`/app/design/${project.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  const sampleUnit = useMemo(() => content?.units?.find((u) => u.role !== "cover" && u.role !== "flyer") ?? content?.units?.[0], [content]);

  if (catalogError) return <p className="p-8 text-sm text-red-700">{catalogError}</p>;
  if (!catalog) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-subtle">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 lg:py-12">
      <Stepper step={run?.title?.startsWith("Designing") ? 4 : step} />
      {error && (
        <div role="alert" className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {run ? (
        <div className="space-y-6">
          <RunProgress title={run.title} steps={run.steps} progress={progress} onCancel={() => abortRef.current?.abort()} />
          {run.title.startsWith("Writing") && content?.units?.length > 0 && (
            <div className="space-y-2">
              {content.units.filter(Boolean).map((u, i) => (
                <div key={i} className="animate-fade-in card px-4 py-3 text-sm">
                  <span className="mr-2 text-xs font-semibold text-accent">{i + 1}</span>
                  <span className="font-medium text-ink">{u.content.headline}</span>
                  <span className="ml-2 text-muted">{u.content.subtitle}</span>
                </div>
              ))}
            </div>
          )}
          {run.title.startsWith("Designing") && designed.some(Boolean) && (
            <div className="flex flex-wrap gap-3">
              {designed.map((u, i) =>
                u ? <DesignFrame key={i} catalog={catalog} format={format} style={style} unit={u} width={format === "slides" || format === "infographic" ? 260 : 160} className="animate-fade-in rounded-md shadow-card" /> : null,
              )}
            </div>
          )}
        </div>
      ) : step === 0 ? (
        <form onSubmit={findTopics} className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">What do you want to make?</h1>
          <p className="mt-1 text-sm text-muted">Aurea researches your idea, suggests topics, writes it {UNIT_NOUN[format]} by {UNIT_NOUN[format]}, then designs it in the style you pick.</p>
          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {DESIGN_FORMAT_ORDER.map((id) => {
              const Icon = FORMAT_ICONS[id];
              const active = id === format;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => pickFormat(id)}
                  aria-pressed={active}
                  className={`rounded-xl border p-3 text-left transition ${active ? "border-ink bg-white shadow-card" : "border-line bg-white/60 hover:border-ink/30"}`}
                >
                  <Icon size={18} className={active ? "text-accent" : "text-muted"} />
                  <p className="mt-2 text-sm font-medium text-ink">{catalog.formats[id].label}</p>
                  <p className="text-[11px] text-subtle">
                    {catalog.formats[id].width} x {catalog.formats[id].height ?? "auto"}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-subtle">{f.description}</p>
          <label className="field-label mt-6" htmlFor="query">
            Your idea or question
          </label>
          <textarea id="query" className="input min-h-24" value={query} maxLength={500} onChange={(e) => setQuery(e.target.value)} placeholder="For example: why freelancers should stop charging by the hour" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="audience">
                Audience <span className="text-subtle">(optional)</span>
              </label>
              <input id="audience" className="input" value={audience} maxLength={200} onChange={(e) => setAudience(e.target.value)} placeholder="Freelance designers and developers" />
            </div>
            {f.count.min !== f.count.max && (
              <div>
                <label className="field-label" htmlFor="count">
                  {UNIT_NOUN[format][0].toUpperCase() + UNIT_NOUN[format].slice(1)}s: {count}
                </label>
                <input id="count" type="range" className="mt-3 w-full accent-[var(--color-accent)]" min={f.count.min} max={f.count.max} value={count} onChange={(e) => setCount(Number(e.target.value))} />
              </div>
            )}
          </div>
          <label className="field-label mt-4" htmlFor="notes">
            Notes, facts, or details to include <span className="text-subtle">(optional)</span>
          </label>
          <textarea id="notes" className="input min-h-20" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder={format === "flyer" || format === "brochure" ? "Date, time, place, price, contact details, offer terms" : "Names, numbers, links, or angles you want covered"} />
          <div className="mt-8 flex flex-col-reverse items-center gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
            <Link to="/app/new" className="text-xs text-muted hover:text-ink">
              Need a text post or a template design? Use the classic creator
            </Link>
            <button type="submit" className="btn btn-accent btn-lg" disabled={!query.trim()}>
              <Search size={16} /> Find topics
            </button>
          </div>
        </form>
      ) : step === 1 ? (
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Pick a topic</h1>
          <p className="mt-1 text-sm text-muted">Grounded in current sources for "{query}".</p>
          <div className="mt-6 space-y-2.5">
            {topics.map((t, i) => (
              <button
                key={t.title}
                type="button"
                onClick={() => setChosen(i)}
                aria-pressed={chosen === i}
                className={`block w-full rounded-xl border p-4 text-left transition ${chosen === i ? "border-ink bg-white shadow-card" : "border-line bg-white/60 hover:border-ink/30"}`}
              >
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                <p className="mt-0.5 text-sm text-muted">{t.angle}</p>
                {t.why && <p className="mt-1 text-xs text-subtle">{t.why}</p>}
              </button>
            ))}
            <div className={`rounded-xl border p-4 ${chosen === "custom" ? "border-ink bg-white shadow-card" : "border-line bg-white/60"}`}>
              <label className="text-sm font-semibold text-ink" htmlFor="custom-topic">
                Or write your own topic
              </label>
              <input id="custom-topic" className="input mt-2" value={customTopic} maxLength={120} onFocus={() => setChosen("custom")} onChange={(e) => setCustomTopic(e.target.value)} placeholder="Your topic" />
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-line pt-6">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>
              <ArrowLeft size={15} /> Back
            </button>
            <button type="button" className="btn btn-secondary" onClick={findTopics}>
              <RefreshCw size={14} /> New topics
            </button>
            <button type="button" className="btn btn-accent btn-lg ml-auto" onClick={writeContent} disabled={!topic?.title}>
              <Sparkles size={16} /> Write the content
            </button>
          </div>
        </div>
      ) : step === 2 ? (
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Review the content</h1>
          <p className="mt-1 text-sm text-muted">
            {content.title}. Edit anything before it is designed: the design uses exactly this text.
          </p>
          <div className="mt-6 space-y-3">
            {content.units.map((u, i) => (
              <UnitEditor
                key={i}
                format={format}
                index={i}
                unit={u}
                canDelete={content.units.length > f.count.min}
                onChange={(next) => setContent((c) => ({ ...c, units: c.units.map((x, j) => (j === i ? next : x)) }))}
                onDelete={() => setContent((c) => ({ ...c, units: c.units.filter((_, j) => j !== i) }))}
              />
            ))}
          </div>
          <div className="mt-8 flex items-center gap-2 border-t border-line pt-6">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
              <ArrowLeft size={15} /> Back
            </button>
            <button type="button" className="btn btn-accent btn-lg ml-auto" onClick={() => setStep(3)} disabled={content.units.some((u) => !u.content.headline.trim())}>
              Choose a style <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Choose a style</h1>
          <p className="mt-1 text-sm text-muted">Each preview uses one of your own {UNIT_NOUN[format]}s. The AI designs every page freely in the style you pick.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(catalog.styles).map(([id, s]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStyle(id)}
                aria-pressed={style === id}
                className={`overflow-hidden rounded-xl border text-left transition ${style === id ? "border-ink shadow-pop ring-2 ring-accent ring-offset-2" : "border-line hover:border-ink/30"}`}
              >
                <div className="flex justify-center bg-paper p-3">
                  <DesignFrame catalog={catalog} format={format} style={id} unit={{ page: samplePage(format, sampleUnit, meta) }} width={format === "slides" || format === "brochure" || format === "infographic" ? 240 : 170} className="rounded shadow-card" title={`${s.name} preview`} />
                </div>
                <div className="bg-white p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    {s.name}
                    <span className="ml-auto flex gap-0.5">
                      {s.swatches.map((c) => (
                        <span key={c} className="h-3 w-3 rounded-full ring-1 ring-ink/10" style={{ background: c }} />
                      ))}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-subtle">Best for {s.best_for}</p>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">{catalog.styles[style].mood}</p>
          <label className="field-label mt-6" htmlFor="ideas">
            Your design ideas <span className="text-subtle">(optional)</span>
          </label>
          <textarea id="ideas" className="input min-h-20" value={ideas} maxLength={600} onChange={(e) => setIdeas(e.target.value)} placeholder="For example: more diagrams than text, a comparison table on slide 3, keep the cover very bold" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="author">
                Author
              </label>
              <input id="author" className="input" value={meta.author} maxLength={60} onChange={(e) => setMeta((m) => ({ ...m, author: e.target.value }))} />
            </div>
            <div>
              <label className="field-label" htmlFor="brand">
                Brand
              </label>
              <input id="brand" className="input" value={meta.brand} maxLength={60} onChange={(e) => setMeta((m) => ({ ...m, brand: e.target.value }))} />
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>
              <ArrowLeft size={15} /> Back
            </button>
            {designs && (
              <span className={`text-xs ${designs.left ? "text-subtle" : "text-amber-700"}`}>
                {designs.left ? `Uses 1 of your ${designs.left} designs left today. About a minute per ${UNIT_NOUN[format]} on the local model.` : `You have used all ${designs.limit} designs for today. More after ${resetTime(usage)}.`}
              </span>
            )}
            <button type="button" className="btn btn-accent btn-lg ml-auto" onClick={generate} disabled={designs ? designs.left <= 0 : false}>
              <WandSparkles size={16} /> Design it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
