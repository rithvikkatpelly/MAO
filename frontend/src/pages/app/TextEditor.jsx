import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Copy, ExternalLink, Lightbulb, Loader2, Redo2, RefreshCw, Undo2 } from "lucide-react";
import { ScheduleButton } from "../../components/editor/Checks";
import HistoryButton from "../../components/editor/HistoryPanel";
import RepurposePanel, { OutputEditor } from "../../components/editor/RepurposePanel";
import SaveStatus from "../../components/editor/SaveStatus";
import Sources from "../../components/editor/Sources";
import { useToast } from "../../components/Toast";
import { ai, projectForAI, versions } from "../../lib/api";
import { useAutosave } from "../../lib/autosave";
import { useProjectBrand } from "../../lib/brandkits";
import { TEXT_FORMATS } from "../../lib/formats";
import { useUndoable } from "../../lib/history";
import { MOD_KEY, isMod } from "../../lib/keys";
import { composerFor, openComposer, outputToText } from "../../lib/outputs";
import { defaultDesign, makeSlide } from "../../lib/project";
import { insertProject } from "../../lib/storage";

// Editor for text-only projects: X threads, LinkedIn posts, scripts, newsletters, YouTube packages.
export default function TextEditor({ initial }) {
  const toast = useToast();
  const navigate = useNavigate();
  const history = useUndoable(initial);
  const { state: project, set } = history;
  const brand = useProjectBrand(project);
  const { saveState, flush } = useAutosave(project, initial);
  const [busy, setBusy] = useState(false);
  const format = project.textFormat;
  const meta = TEXT_FORMATS[format] ?? TEXT_FORMATS.linkedin_post;
  const data = project.outputs?.[format];
  const composer = composerFor(format, data);
  const update = (patch, group) => set((p) => ({ ...p, ...patch }), group);

  useEffect(() => {
    function onKey(e) {
      const key = e.key.toLowerCase();
      if (isMod(e) && key === "z") {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
      } else if (isMod(e) && key === "s") {
        e.preventDefault();
        flush();
        toast("All changes saved");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history, flush, toast]);

  async function regenerate() {
    setBusy(true);
    try {
      const result = await ai.repurpose(format, projectForAI(project));
      update({ outputs: { ...project.outputs, [format]: result.data } });
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(outputToText(format, data));
      toast("Copied");
      versions.create(project, "export", "Copied").catch(() => {});
    } catch {
      toast("Could not access the clipboard", { tone: "error" });
    }
  }

  function makeThumbnail(text) {
    const thumb = insertProject({
      title: `${project.title} thumbnail`,
      kind: "thumbnail",
      size: "youtube",
      design: { ...defaultDesign("thumbnail", brand, "bold"), showBrand: false },
      slides: [makeSlide({ headline: text })],
      caption: "",
      hashtags: [],
      cta: "",
      source: project.source,
    });
    navigate(`/app/p/${thumb.id}`);
  }

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-white px-2 sm:px-3">
        <Link to="/app" className="btn btn-ghost btn-icon" aria-label="Back to projects">
          <ChevronLeft size={18} />
        </Link>
        <input
          value={project.title}
          onChange={(e) => update({ title: e.target.value }, "title")}
          onBlur={(e) => !e.target.value.trim() && update({ title: "Untitled" })}
          aria-label="Project title"
          className="h-8 min-w-0 max-w-xs flex-1 truncate rounded-md px-2 text-sm font-medium text-ink outline-none hover:bg-paper focus:bg-paper"
        />
        <span className="hidden items-center gap-1.5 rounded-md bg-paper px-2 py-1 text-xs text-muted md:flex">
          <meta.icon size={12} /> {meta.label}
        </span>
        <div className="flex-1" />
        <SaveStatus state={saveState} />
        <button className="btn btn-ghost btn-icon" onClick={history.undo} disabled={!history.canUndo} title={`Undo (${MOD_KEY} Z)`} aria-label="Undo">
          <Undo2 size={16} />
        </button>
        <button className="btn btn-ghost btn-icon" onClick={history.redo} disabled={!history.canRedo} title={`Redo (${MOD_KEY} Shift Z)`} aria-label="Redo">
          <Redo2 size={16} />
        </button>
        <HistoryButton
          project={project}
          brand={brand}
          onOpen={flush}
          onRestore={(data) => set((p) => ({ ...data, id: p.id, createdAt: p.createdAt, updatedAt: p.updatedAt }))}
        />
        <ScheduleButton project={project} onChange={update} />
        <button className="btn btn-accent" onClick={copy} disabled={!data}>
          <Copy size={15} /> <span className="hidden sm:inline">Copy</span>
        </button>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-8 lg:grid-cols-[1fr_340px]">
        <main className="card p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-ink">{meta.label}</h1>
              <p className="text-xs text-subtle">{meta.description}</p>
            </div>
            <div className="flex gap-2">
              {composer && (
                <button className="btn btn-secondary" onClick={() => openComposer(composer.platform, composer.text)}>
                  <ExternalLink size={14} /> Open in {composer.platform === "x" ? "X" : "LinkedIn"}
                </button>
              )}
              <button className="btn btn-secondary" onClick={regenerate} disabled={busy}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Rewrite
              </button>
            </div>
          </div>
          {data ? (
            <OutputEditor format={format} data={data} onChange={(next) => update({ outputs: { ...project.outputs, [format]: next } }, "main-output")} onMakeThumbnail={makeThumbnail} />
          ) : (
            <p className="text-sm text-muted">Nothing written yet. Click Rewrite to generate it.</p>
          )}
        </main>

        <aside className="space-y-6">
          {project.source?.idea && (
            <div className="card p-5">
              <p className="mb-3 text-xs font-semibold tracking-wide text-ink uppercase">Idea</p>
              <div className="flex gap-2.5">
                <Lightbulb size={15} className="mt-0.5 shrink-0 text-accent" />
                <div className="text-xs">
                  <p className="font-medium text-ink">{project.source.idea.title}</p>
                  <p className="mt-1 text-muted">{project.source.idea.angle}</p>
                </div>
              </div>
            </div>
          )}
          <div className="card p-5">
            <p className="mb-3 text-xs font-semibold tracking-wide text-ink uppercase">Also turn it into</p>
            <RepurposePanel project={project} onChange={update} onMakeThumbnail={makeThumbnail} formats={Object.keys(TEXT_FORMATS).filter((f) => f !== format)} />
          </div>
          {(project.sources?.length ?? 0) > 0 && (
            <div className="card p-5">
              <p className="mb-3 text-xs font-semibold tracking-wide text-ink uppercase">Research sources</p>
              <Sources project={{ ...project, slides: [{ layout: "sources" }] }} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
