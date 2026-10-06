import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Copy,
  Download,
  FileText,
  FolderArchive,
  ImageDown,
  Loader2,
  PenTool,
  Plus,
  Presentation,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import { Menu } from "../../components/Menu";
import { FitSlide, SlideFrame } from "../../components/SlideFrame";
import { useToast } from "../../components/Toast";
import { AutoTextarea, CharCount, ColorPicker, Segmented, Toggle } from "../../components/controls";
import HistoryButton from "../../components/editor/HistoryPanel";
import InstagramPublishButton from "../../components/editor/InstagramPublish";
import SaveStatus from "../../components/editor/SaveStatus";
import VisualPanel from "../../components/visual/VisualPanel";
import { versions } from "../../lib/api";
import { useAutosave } from "../../lib/autosave";
import { useProjectBrand } from "../../lib/brandkits";
import { copyPng, exportPdf, exportPng, exportPptx, exportSvg, exportZip } from "../../lib/export";
import { CUSTOM_PREFIX, customFontCss, useCustomFonts } from "../../lib/fonts";
import { STUDIO_FORMATS, sizeOf } from "../../lib/formats";
import { useUndoable } from "../../lib/history";
import { MOD_KEY, isMod, isTyping } from "../../lib/keys";
import { makeSlide } from "../../lib/project";
import { uid, useProjectsState } from "../../lib/storage";
import { FONTS, TEMPLATES } from "../../lib/templates";
import { formatHashtags } from "../../lib/text";
import { starterVisual } from "../../lib/visualTypes";

const LIMITS = { deck: 20, infographic: 8 };

// ---- top bar -----------------------------------------------------------------------------------

function TopBar({ project, brand, history, saveState, exporting, onExport, onTitle, onRestore, onFlush, onPublished }) {
  const format = STUDIO_FORMATS[project.kind];
  const size = sizeOf(project);
  const deck = project.kind === "deck";
  const items = deck
    ? [
        { label: "PNG image", hint: "This slide at 1920 x 1080", icon: ImageDown, onClick: () => onExport("png") },
        { label: "All slides as PNG", hint: "ZIP archive, one file per slide", icon: FolderArchive, onClick: () => onExport("zip") },
        { label: "PDF document", hint: "For sharing or a LinkedIn document post", icon: FileText, onClick: () => onExport("pdf") },
        { label: "PowerPoint", hint: "PPTX with your speaker notes", icon: Presentation, onClick: () => onExport("pptx") },
        "divider",
        { label: "Copy image", hint: "This slide, to your clipboard", icon: ClipboardCopy, onClick: () => onExport("copy") },
        { label: "Copy caption", hint: "Caption and hashtags for sharing", icon: Copy, onClick: () => onExport("caption") },
      ]
    : [
        { label: "PNG image", hint: `This page at ${size.w} x ${size.h}`, icon: ImageDown, onClick: () => onExport("png") },
        { label: "SVG vector", hint: "This page, scales to any size", icon: PenTool, onClick: () => onExport("svg") },
        project.slides.length > 1 && { label: "All pages as PNG", hint: "ZIP archive, one file per page", icon: FolderArchive, onClick: () => onExport("zip") },
        { label: "PDF document", hint: "Every page, print ready", icon: FileText, onClick: () => onExport("pdf") },
        "divider",
        { label: "Copy image", hint: "To your clipboard", icon: ClipboardCopy, onClick: () => onExport("copy") },
        { label: "Copy caption", hint: "Caption and hashtags for sharing", icon: Copy, onClick: () => onExport("caption") },
      ];

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-white px-2 sm:px-3">
      <Link to="/app" className="btn btn-ghost btn-icon" aria-label="Back to projects" title="Back to projects">
        <ChevronLeft size={18} />
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <input
          value={project.title}
          onChange={(e) => onTitle(e.target.value)}
          onBlur={(e) => !e.target.value.trim() && onTitle("Untitled")}
          aria-label="Project title"
          className="h-8 min-w-0 max-w-xs flex-1 truncate rounded-md px-2 text-sm font-medium text-ink outline-none hover:bg-paper focus:bg-paper focus:ring-2 focus:ring-ink/10"
        />
        <span className="hidden items-center gap-1.5 rounded-md bg-paper px-2 py-1 text-xs text-muted md:flex">
          <format.icon size={12} /> {format.label} <span aria-hidden>·</span> {size.w} x {size.h}
        </span>
      </div>
      <SaveStatus state={saveState} />
      <div className="mx-1 hidden h-5 w-px bg-line sm:block" />
      <HistoryButton project={project} brand={brand} onRestore={onRestore} onOpen={onFlush} />
      <InstagramPublishButton project={project} brand={brand} onPublished={onPublished} onOpen={onFlush} />
      <button className="btn btn-ghost btn-icon" onClick={history.undo} disabled={!history.canUndo} title={`Undo (${MOD_KEY} Z)`} aria-label="Undo">
        <Undo2 size={16} />
      </button>
      <button className="btn btn-ghost btn-icon" onClick={history.redo} disabled={!history.canRedo} title={`Redo (${MOD_KEY} Shift Z)`} aria-label="Redo">
        <Redo2 size={16} />
      </button>
      <Menu
        width="w-64"
        trigger={({ toggle }) => (
          <button className="btn btn-accent ml-1" onClick={toggle} disabled={!!exporting}>
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span className="hidden sm:inline">{exporting ? "Exporting" : "Export"}</span>
            <ChevronDown size={14} className="-mr-1 opacity-70" />
          </button>
        )}
        items={items}
      />
    </header>
  );
}

// ---- rail ----------------------------------------------------------------------------------------

function RailActions({ index, count, onMove, onDuplicate, onDelete, limit }) {
  return (
    <span className="absolute top-1.5 right-1.5 hidden gap-0.5 rounded-md bg-white/95 p-0.5 shadow-card group-hover:flex">
      <button type="button" className="btn btn-ghost h-6 w-6 px-0" onClick={(e) => (e.stopPropagation(), onMove(index, index - 1))} disabled={index === 0} aria-label="Move up">
        <ArrowUp size={12} />
      </button>
      <button type="button" className="btn btn-ghost h-6 w-6 px-0" onClick={(e) => (e.stopPropagation(), onMove(index, index + 1))} disabled={index === count - 1} aria-label="Move down">
        <ArrowDown size={12} />
      </button>
      <button type="button" className="btn btn-ghost h-6 w-6 px-0" onClick={(e) => (e.stopPropagation(), onDuplicate(index))} disabled={count >= limit} aria-label="Duplicate">
        <Copy size={12} />
      </button>
      <button type="button" className="btn btn-ghost h-6 w-6 px-0" onClick={(e) => (e.stopPropagation(), onDelete(index))} disabled={count <= 1} aria-label="Delete">
        <Trash2 size={12} />
      </button>
    </span>
  );
}

function PageRail({ project, brand, active, onSelect, onAdd, ...actions }) {
  return (
    <div className="scrollbar-thin flex gap-3 overflow-x-auto p-3 lg:h-full lg:flex-col lg:overflow-y-auto lg:p-4">
      {project.slides.map((slide, i) => (
        <div key={slide.id} className="group relative flex shrink-0 gap-2">
          <span className="hidden w-4 pt-1 text-right text-[11px] tabular-nums text-subtle lg:block">{i + 1}</span>
          <button type="button" onClick={() => onSelect(i)} className={`block overflow-hidden rounded-md transition ${i === active ? "ring-2 ring-accent ring-offset-2" : "ring-1 ring-line hover:ring-ink/25"}`}>
            <SlideFrame project={project} slide={slide} index={i} brand={brand} width={project.kind === "deck" ? 150 : 120} />
          </button>
          <RailActions index={i} count={project.slides.length} limit={LIMITS[project.kind]} {...actions} />
        </div>
      ))}
      <button type="button" onClick={() => onAdd(active)} disabled={project.slides.length >= LIMITS[project.kind]} className="btn btn-secondary shrink-0 lg:ml-6">
        <Plus size={14} /> {project.kind === "deck" ? "Slide" : "Page"}
      </button>
    </div>
  );
}

// ---- side panels -----------------------------------------------------------------------------------

function Field({ label, value, onChange, limit, multiline, placeholder, rows = 2 }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        {limit && <CharCount value={value ?? ""} limit={limit} />}
      </span>
      {multiline ? (
        <AutoTextarea className="input" minRows={rows} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input" value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function TextPanel({ project, slide, onSlide, onDesign, onProject }) {
  const deck = project.kind === "deck";
  if (!deck) {
    return (
      <div className="space-y-4 p-5">
        <Field label="Title" value={slide.headline} limit={60} onChange={(headline) => onSlide({ headline }, "headline")} />
        <div className="divide-y divide-line">
          <Toggle label="Show title" description="Off leaves only the diagram" checked={project.design.showTitle !== false} onChange={(v) => onDesign({ showTitle: v })} />
        </div>
        <Field label="Caption for sharing" value={project.caption} multiline rows={3} onChange={(caption) => onProject({ caption }, "caption")} />
      </div>
    );
  }
  return (
    <div className="space-y-4 p-5">
      <Field label="Label" value={slide.kicker} limit={30} placeholder="Optional, above the headline" onChange={(kicker) => onSlide({ kicker }, "kicker")} />
      <Field label="Headline" value={slide.headline} limit={deck ? 80 : 70} multiline onChange={(headline) => onSlide({ headline }, "headline")} />
      <Field label={slide.visual ? "Supporting line" : "Body"} value={slide.body} limit={deck ? 220 : 140} multiline onChange={(body) => onSlide({ body }, "body")} />
      {deck && <Field label="Speaker notes" value={slide.notes} multiline rows={4} placeholder="What you say on this slide. Exported with PowerPoint." onChange={(notes) => onSlide({ notes }, "notes")} />}
      <div className="divide-y divide-line">
        <Toggle label="Show diagram" description={slide.visual ? undefined : "Add one in the Diagram tab"} checked={slide.layout === "visual" && !!slide.visual} onChange={(v) => slide.visual && onSlide({ layout: v ? "visual" : "standard" })} />
      </div>
    </div>
  );
}

function DesignPanel({ project, slide, index, brand, onDesign }) {
  const { design } = project;
  const customFonts = useCustomFonts();
  const fontOptions = [["auto", { label: "Template", css: undefined }], ...Object.entries(FONTS), ...customFonts.map((f) => [CUSTOM_PREFIX + f.family, { label: f.family, css: customFontCss(f.family) }])];
  const deck = project.kind === "deck";
  return (
    <div className="space-y-6 p-5">
      <div>
        <p className="field-label">Template</p>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(TEMPLATES).map(([id, tpl]) => {
            const active = design.template === id;
            const preview = { ...project, design: { ...design, template: id } };
            return (
              <button key={id} type="button" onClick={() => onDesign({ template: id })} className="group text-left" aria-pressed={active}>
                <span className={`block overflow-hidden rounded-lg transition ${active ? "ring-2 ring-accent ring-offset-2" : "ring-1 ring-line group-hover:ring-ink/25"}`}>
                  <SlideFrame project={preview} slide={slide} index={index} brand={brand} width={138} />
                </span>
                <span className={`mt-1.5 flex items-center gap-1 text-xs ${active ? "font-medium text-ink" : "text-muted"}`}>
                  {active && <Check size={12} />} {tpl.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="field-label">Color</p>
        <ColorPicker value={design.accent} onChange={(accent) => onDesign({ accent }, "accent")} />
      </div>
      <div>
        <p className="field-label">Headline font</p>
        <div className="grid grid-cols-2 gap-1.5">
          {fontOptions.map(([id, font]) => (
            <button key={id} type="button" onClick={() => onDesign({ font: id })} className={`h-10 truncate rounded-lg border px-3 text-left text-sm transition ${design.font === id ? "border-ink bg-white text-ink" : "border-line text-muted hover:border-ink/25 hover:text-ink"}`} style={{ fontFamily: font.css }}>
              {font.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        {(
          <Segmented
            value={design.align}
            onChange={(align) => onDesign({ align })}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
            ]}
          />
        )}
        <div className="mt-3 divide-y divide-line">
          <Toggle label="Brand name and handle" checked={design.showBrand} onChange={(v) => onDesign({ showBrand: v })} />
          {deck ? (
            <Toggle label="Slide numbers" checked={design.showNumbers} onChange={(v) => onDesign({ showNumbers: v })} />
          ) : (
            <Toggle label="Title" checked={design.showTitle !== false} onChange={(v) => onDesign({ showTitle: v })} />
          )}
        </div>
      </div>
      <button type="button" className="btn btn-secondary w-full" onClick={() => onDesign({ accent: brand.accent, font: brand.font, ...(brand.template !== "auto" ? { template: brand.template } : {}) })}>
        Apply brand kit
      </button>
    </div>
  );
}

// ---- studio --------------------------------------------------------------------------------------

const TABS = [
  { value: "visual", label: "Diagram" },
  { value: "text", label: "Text" },
  { value: "design", label: "Design" },
];

const EXPORT_LABELS = { png: "PNG export", zip: "ZIP export", pdf: "PDF export", pptx: "PowerPoint export", svg: "SVG export" };

function Studio({ initial }) {
  const toast = useToast();
  const history = useUndoable(initial);
  const { state: project, set } = history;
  const brand = useProjectBrand(project);
  const deck = project.kind === "deck";
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState("visual");
  const [exporting, setExporting] = useState(null);
  const { saveState, flush } = useAutosave(project, initial);

  const index = Math.min(active, project.slides.length - 1);
  const slide = project.slides[index];

  const update = useCallback((patch, group) => set((p) => ({ ...p, ...patch }), group), [set]);
  const updateDesign = useCallback((patch, group) => set((p) => ({ ...p, design: { ...p.design, ...patch } }), group), [set]);
  const updateSlide = useCallback((patch, group) => set((p) => ({ ...p, slides: p.slides.map((s, i) => (i === index ? { ...s, ...patch } : s)) }), group), [set, index]);

  const addSlide = useCallback(
    (after) => {
      const fresh = deck
        ? makeSlide({ role: "content", kicker: "", headline: "New slide", body: "", notes: "", layout: "standard" })
        : makeSlide({ role: "page", kicker: "", headline: "New infographic", body: "", notes: "", layout: "visual", visual: starterVisual("process") });
      set((p) => {
        const slides = [...p.slides];
        slides.splice(after + 1, 0, fresh);
        return { ...p, slides };
      });
      setActive(after + 1);
      setTab("visual");
    },
    [set, deck],
  );
  const duplicateSlide = useCallback(
    (i) => {
      set((p) => {
        const slides = [...p.slides];
        slides.splice(i + 1, 0, { ...p.slides[i], id: uid() });
        return { ...p, slides };
      });
      setActive(i + 1);
    },
    [set],
  );
  const deleteSlide = useCallback(
    (i) => {
      set((p) => (p.slides.length <= 1 ? p : { ...p, slides: p.slides.filter((_, j) => j !== i) }));
      setActive((a) => Math.max(0, a > i ? a - 1 : a === i ? i - 1 : a));
    },
    [set],
  );
  const moveSlide = useCallback(
    (from, to) => {
      set((p) => {
        if (to < 0 || to >= p.slides.length) return p;
        const slides = [...p.slides];
        const [moved] = slides.splice(from, 1);
        slides.splice(to, 0, moved);
        return { ...p, slides };
      });
      setActive(to);
    },
    [set],
  );
  const restoreVersion = useCallback(
    (data) => {
      set((p) => ({ ...data, id: p.id, createdAt: p.createdAt, updatedAt: p.updatedAt }));
      setActive(0);
    },
    [set],
  );

  async function handleExport(type) {
    if (type === "caption") {
      try {
        await navigator.clipboard.writeText([project.caption, formatHashtags(project.hashtags)].filter(Boolean).join("\n\n"));
        toast("Caption copied");
      } catch {
        toast("Could not access the clipboard", { tone: "error" });
      }
      return;
    }
    setExporting(type);
    const at = index;
    try {
      if (type === "png") await exportPng(project, brand, at);
      else if (type === "zip") await exportZip(project, brand);
      else if (type === "pdf") await exportPdf(project, brand);
      else if (type === "pptx") await exportPptx(project, brand);
      else if (type === "svg") await exportSvg(project, brand, at);
      else if (type === "copy") await copyPng(project, brand, at);
      toast(type === "copy" ? "Image copied to clipboard" : "Download started");
      if (type !== "copy") versions.create(project, "export", EXPORT_LABELS[type]).catch(() => {});
    } catch (err) {
      console.error(err);
      toast(type === "copy" ? "Your browser blocked copying images. Try PNG export instead." : "Export failed. Please try again.", { tone: "error" });
    } finally {
      setExporting(null);
    }
  }

  function handlePublished({ permalink, posted_at }) {
    update({ published: [...(project.published ?? []), { platform: "instagram", url: permalink, at: posted_at }] });
    versions.create(project, "export", "Posted to Instagram").catch(() => {});
  }

  useEffect(() => {
    function onKey(e) {
      const key = e.key.toLowerCase();
      if (isMod(e) && key === "z") {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
      } else if (isMod(e) && key === "y") {
        e.preventDefault();
        history.redo();
      } else if (isMod(e) && key === "s") {
        e.preventDefault();
        flush();
        toast("All changes saved");
      } else if (!isTyping(e) && (e.key === "ArrowRight" || e.key === "ArrowDown")) {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, project.slides.length - 1));
      } else if (!isTyping(e) && (e.key === "ArrowLeft" || e.key === "ArrowUp")) {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history, flush, toast, project.slides.length]);

  const railProps = { project, brand, active: index, onSelect: setActive, onAdd: addSlide, onMove: moveSlide, onDuplicate: duplicateSlide, onDelete: deleteSlide };

  return (
    <div className="flex min-h-dvh flex-col bg-paper lg:h-dvh">
      <TopBar
        project={project}
        brand={brand}
        history={history}
        saveState={saveState}
        exporting={exporting}
        onExport={handleExport}
        onTitle={(title) => update({ title }, "title")}
        onRestore={restoreVersion}
        onFlush={flush}
        onPublished={handlePublished}
      />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {deck && (
          <aside className="shrink-0 border-b border-line bg-paper lg:w-[228px] lg:border-r lg:border-b-0">
            <PageRail {...railProps} />
          </aside>
        )}

        <main className="bg-dots flex min-h-[60vh] min-w-0 flex-1 flex-col lg:min-h-0">
          <FitSlide project={project} slide={slide} index={index} brand={brand} padding={40} className="min-h-0 flex-1" frameClassName="rounded-sm shadow-pop" />
          {project.slides.length > 1 && (
          <div className="flex items-center justify-center gap-2 pb-4">
            <button className="btn btn-secondary btn-icon" onClick={() => setActive(index - 1)} disabled={index <= 0} aria-label={deck ? "Previous slide" : "Previous page"}>
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-16 text-center text-xs font-medium tabular-nums text-muted">
              {index + 1} / {project.slides.length}
            </span>
            <button className="btn btn-secondary btn-icon" onClick={() => setActive(index + 1)} disabled={index >= project.slides.length - 1} aria-label={deck ? "Next slide" : "Next page"}>
              <ChevronRight size={16} />
            </button>
          </div>
          )}
        </main>

        <aside className="flex shrink-0 flex-col border-t border-line bg-white lg:w-[380px] lg:border-t-0 lg:border-l">
          <div className="border-b border-line p-3">
            <Segmented value={tab} onChange={setTab} options={TABS} />
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            {tab === "visual" && <VisualPanel key={slide.id} project={project} slide={slide} onSlide={updateSlide} />}
            {tab === "text" && <TextPanel project={project} slide={slide} onSlide={updateSlide} onDesign={updateDesign} onProject={update} />}
            {tab === "design" && <DesignPanel project={project} slide={slide} index={index} brand={brand} onDesign={updateDesign} />}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function VisualEditorPage() {
  const { id } = useParams();
  const { status, items } = useProjectsState();
  const project = items.find((p) => p.id === id) ?? null;
  const [frozen, setFrozen] = useState({ id, project });
  if (frozen.id !== id || (!frozen.project && project)) setFrozen({ id, project });
  const initial = frozen.id === id && frozen.project ? frozen.project : project;

  if (!initial && (status === "loading" || status === "idle")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-subtle">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }
  if (!initial || !STUDIO_FORMATS[initial.kind]) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
        <h1 className="text-xl font-semibold text-ink">Project not found</h1>
        <p className="text-sm text-muted">It may have been deleted, or it belongs to another account.</p>
        <Link to="/app" className="btn btn-primary mt-3">
          Back to projects
        </Link>
      </div>
    );
  }
  return <Studio key={id} initial={initial} />;
}
