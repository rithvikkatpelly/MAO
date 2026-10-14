import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Download, FileText, History, ImageDown, Loader2, Sparkles, TriangleAlert, WandSparkles } from "lucide-react";
import DesignFrame from "../../components/design/DesignFrame";
import SaveStatus from "../../components/editor/SaveStatus";
import { Menu } from "../../components/Menu";
import { Segmented } from "../../components/controls";
import { useToast } from "../../components/Toast";
import { design } from "../../lib/api";
import { useAutosave } from "../../lib/autosave";
import { downloadBlob, unitSize, useCatalog } from "../../lib/design";
import { useProjectsState } from "../../lib/storage";

const NOUN = { carousel: "slide", slides: "slide", infographic: "section", flyer: "page", brochure: "panel" };
const VERSIONS_KEPT = 5;
const SUGGESTIONS = ["Make it more visual", "Use a comparison table", "Cut the text in half", "Add a stat card with the key number", "Make the title bolder"];

function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref]);
  return width;
}

function ContentFields({ content, onChange }) {
  const set = (patch) => onChange({ ...content, ...patch });
  return (
    <div className="space-y-2.5">
      <input className="input text-sm font-medium" value={content.headline} maxLength={90} onChange={(e) => set({ headline: e.target.value })} aria-label="Headline" />
      <input className="input text-sm" value={content.subtitle} maxLength={150} onChange={(e) => set({ subtitle: e.target.value })} aria-label="Subtitle" />
      {content.points.map((p, i) => (
        <div key={i} className="flex gap-1.5">
          <input className="input w-28 shrink-0 text-xs" value={p.label} maxLength={40} onChange={(e) => set({ points: content.points.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} aria-label={`Point ${i + 1} label`} />
          <input className="input text-xs" value={p.text} maxLength={220} onChange={(e) => set({ points: content.points.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} aria-label={`Point ${i + 1}`} />
        </div>
      ))}
      <input className="input text-sm" value={content.takeaway} maxLength={150} onChange={(e) => set({ takeaway: e.target.value })} aria-label="Takeaway" placeholder="Takeaway" />
      {content.notes !== undefined && content.notes !== "" && (
        <textarea className="input min-h-16 text-xs" value={content.notes} maxLength={600} onChange={(e) => set({ notes: e.target.value })} aria-label="Speaker notes" />
      )}
    </div>
  );
}

function Viewer({ initial, catalog }) {
  const toast = useToast();
  const [project, setProject] = useState(initial);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState("ai");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(null);
  const [draftState, setDraftState] = useState(null); // { index, content }: edited content for one unit
  const stageRef = useRef(null);
  const stageWidth = useWidth(stageRef);
  const { saveState } = useAutosave(project, initial);

  const { format, style } = project;
  const units = project.slides;
  const index = Math.min(active, units.length - 1);
  const unit = units[index];
  const noun = NOUN[format] ?? "page";
  const { w, h } = unitSize(catalog, format, unit);
  const fit = stageWidth ? Math.min(stageWidth - 48, (window.innerHeight - 190) * (w / h), w * 1.4) : 0;

  const draft = draftState?.index === index ? draftState.content : null;
  const setDraft = (content) => setDraftState(content ? { index, content } : null);

  function replaceUnit(i, next) {
    setProject((p) => ({ ...p, slides: p.slides.map((u, j) => (j === i ? next : u)) }));
  }

  async function redesign({ withInstruction }) {
    const content = draft ?? unit.content;
    setBusy("redesign");
    try {
      const res = await design.unit({
        format,
        style,
        index,
        total: units.length,
        unit: { role: unit.role, content, html: unit.html },
        instruction: withInstruction ? instruction.trim() : "",
        design_ideas: project.designIdeas ?? "",
        meta: project.meta ?? {},
      });
      const previous = [{ html: unit.html, page: unit.page, check: unit.check, content: unit.content }, ...(unit.previous ?? [])].slice(0, VERSIONS_KEPT);
      replaceUnit(index, { ...unit, content, html: res.html, page: res.page, check: res.check, warnings: res.warnings ?? [], previous });
      setInstruction("");
      setDraft(null);
      toast(`Redesigned ${noun} ${index + 1}`);
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  function restore(version) {
    const current = { html: unit.html, page: unit.page, check: unit.check, content: unit.content };
    replaceUnit(index, { ...unit, ...version, previous: [current, ...unit.previous.filter((v) => v !== version)].slice(0, VERSIONS_KEPT) });
  }

  async function exportAs(kind) {
    setBusy(kind);
    try {
      const { blob, name } = await design.export({ format, style, kind, title: project.title, units: units.map((u) => ({ html: u.html })), meta: project.meta ?? {} });
      downloadBlob(blob, name);
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-paper">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-white px-3">
        <Link to="/app" className="btn btn-ghost btn-icon" aria-label="Back to projects">
          <ChevronLeft size={18} />
        </Link>
        <input
          value={project.title}
          onChange={(e) => setProject((p) => ({ ...p, title: e.target.value }))}
          aria-label="Project title"
          className="h-8 min-w-0 max-w-xs flex-1 truncate rounded-md px-2 text-sm font-medium text-ink outline-none hover:bg-paper focus:bg-paper"
        />
        <span className="hidden rounded-md bg-paper px-2 py-1 text-xs text-muted md:inline">
          {catalog.formats[format].label} · {catalog.styles[style].name}
        </span>
        <span className="ml-auto" />
        <SaveStatus state={saveState} />
        <Menu
          width="w-60"
          trigger={({ toggle }) => (
            <button className="btn btn-accent" onClick={toggle} disabled={!!busy}>
              {busy === "pdf" || busy === "png" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Export <ChevronDown size={14} className="-mr-1 opacity-70" />
            </button>
          )}
          items={[
            { label: "PDF", hint: format === "brochure" ? "2 pages for duplex printing" : format === "infographic" ? "One tall page" : "Ready to upload or print", icon: FileText, onClick: () => exportAs("pdf") },
            { label: units.length > 1 && format !== "infographic" ? "PNG images" : "PNG image", hint: units.length > 1 && format !== "infographic" ? "ZIP, one image per page at 2x" : "At 2x resolution", icon: ImageDown, onClick: () => exportAs("png") },
          ]}
        />
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="scrollbar-thin hidden w-[190px] shrink-0 space-y-3 overflow-y-auto border-r border-line p-3 lg:block">
          {units.map((u, i) => (
            <button key={u.id} onClick={() => setActive(i)} aria-label={`${noun} ${i + 1}`} aria-current={i === index} className={`block overflow-hidden rounded-md ${i === index ? "ring-2 ring-accent ring-offset-2 ring-offset-paper" : "ring-1 ring-line hover:ring-ink/25"}`}>
              <DesignFrame catalog={catalog} format={format} style={style} unit={u} width={160} />
            </button>
          ))}
        </aside>

        <main ref={stageRef} className="bg-dots flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-auto p-6">
          {fit > 0 && <DesignFrame catalog={catalog} format={format} style={style} unit={unit} width={fit} className="rounded-sm shadow-pop" title={`${noun} ${index + 1}`} />}
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary btn-icon" onClick={() => setActive(index - 1)} disabled={index === 0} aria-label={`Previous ${noun}`}>
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-16 text-center text-xs font-medium tabular-nums text-muted">
              {index + 1} / {units.length}
            </span>
            <button className="btn btn-secondary btn-icon" onClick={() => setActive(index + 1)} disabled={index === units.length - 1} aria-label={`Next ${noun}`}>
              <ChevronRight size={16} />
            </button>
          </div>
        </main>

        <aside className="flex w-full shrink-0 flex-col border-t border-line bg-white lg:w-[360px] lg:border-t-0 lg:border-l">
          <div className="border-b border-line p-3">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: "ai", label: "Edit with AI", icon: WandSparkles },
                { value: "content", label: "Content" },
              ]}
            />
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {unit.warnings?.length > 0 && (
              <ul className="space-y-1 rounded-lg bg-amber-50 p-3">
                {unit.warnings.map((w) => (
                  <li key={w} className="flex gap-1.5 text-xs text-amber-800">
                    <TriangleAlert size={12} className="mt-0.5 shrink-0" /> {w}
                  </li>
                ))}
              </ul>
            )}
            {tab === "ai" ? (
              <>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    Change {noun} {index + 1}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">Say what to change. The AI redesigns this {noun} and keeps the rest.</p>
                </div>
                <textarea className="input min-h-24 text-sm" value={instruction} maxLength={600} onChange={(e) => setInstruction(e.target.value)} placeholder={`For example: turn this ${noun} into a timeline`} disabled={!!busy} />
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-ink/25 hover:text-ink" onClick={() => setInstruction(s)} disabled={!!busy}>
                      {s}
                    </button>
                  ))}
                </div>
                <button type="button" className="btn btn-accent w-full" onClick={() => redesign({ withInstruction: true })} disabled={!!busy || !instruction.trim()}>
                  {busy === "redesign" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {busy === "redesign" ? "Redesigning, about a minute" : `Redesign ${noun}`}
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-muted">Edit the words, then redesign this {noun} with them.</p>
                <ContentFields content={draft ?? unit.content} onChange={setDraft} />
                <button type="button" className="btn btn-accent w-full" onClick={() => redesign({ withInstruction: false })} disabled={!!busy || !draft}>
                  {busy === "redesign" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Redesign with this content
                </button>
              </>
            )}
            {unit.previous?.length > 0 && (
              <div className="border-t border-line pt-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <History size={13} /> Earlier versions
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {unit.previous.map((v, i) => (
                    <button key={i} type="button" onClick={() => restore(v)} className="overflow-hidden rounded ring-1 ring-line hover:ring-ink/30" title="Restore this version" disabled={!!busy}>
                      <DesignFrame catalog={catalog} format={format} style={style} unit={v} width={70} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function DesignViewerPage() {
  const { id } = useParams();
  const { catalog, error } = useCatalog();
  const { status, items } = useProjectsState();
  const project = items.find((p) => p.id === id) ?? null;
  const [frozen, setFrozen] = useState({ id, project });
  if (frozen.id !== id || (!frozen.project && project)) setFrozen({ id, project });
  const initial = frozen.id === id && frozen.project ? frozen.project : project;

  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!catalog || (!initial && (status === "loading" || status === "idle"))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-subtle">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }
  if (!initial || initial.kind !== "design") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
        <h1 className="text-xl font-semibold text-ink">Design not found</h1>
        <Link to="/app" className="btn btn-primary mt-3">
          Back to projects
        </Link>
      </div>
    );
  }
  return <Viewer key={id} initial={initial} catalog={catalog} />;
}
