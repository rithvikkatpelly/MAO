import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlignCenter,
  AlignLeft,
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
  Lightbulb,
  Loader2,
  MoreHorizontal,
  Package,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  WandSparkles,
} from "lucide-react";
import { Menu } from "../../components/Menu";
import CaptionsPanel from "../../components/editor/CaptionsPanel";
import { ChecklistButton, ScheduleButton } from "../../components/editor/Checks";
import HistoryButton from "../../components/editor/HistoryPanel";
import InstagramPublishButton from "../../components/editor/InstagramPublish";
import { BrandKitSelect, SavedTemplates } from "../../components/editor/DesignExtras";
import LayoutFields from "../../components/editor/LayoutFields";
import SaveStatus from "../../components/editor/SaveStatus";
import RepurposePanel from "../../components/editor/RepurposePanel";
import SlideAI from "../../components/editor/SlideAI";
import Sources from "../../components/editor/Sources";
import { FitSlide, SlideFrame } from "../../components/SlideFrame";
import { useToast } from "../../components/Toast";
import { AutoTextarea, CharCount, ColorPicker, Segmented, Toggle } from "../../components/controls";
import { versions } from "../../lib/api";
import { useAutosave } from "../../lib/autosave";
import { useBrandKits, useProjectBrand } from "../../lib/brandkits";
import { copyPng, exportBundle, exportPdf, exportPng, exportZip } from "../../lib/export";
import { CUSTOM_PREFIX, customFontCss, useCustomFonts } from "../../lib/fonts";
import { KINDS, SIZES, SLIDE_LIMIT, sizeOf } from "../../lib/formats";
import { useUndoable } from "../../lib/history";
import { MOD_KEY, isMod, isTyping } from "../../lib/keys";
import { defaultDesign, makeSlide } from "../../lib/project";
import { insertProject, uid, useProjectsState } from "../../lib/storage";
import TextEditor from "./TextEditor";
import { FONTS, TEMPLATES } from "../../lib/templates";
import { cleanProjectCopy, cleanText, formatHashtags, hasStyleIssues, projectHasStyleIssues } from "../../lib/text";


function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// ---- top bar ---------------------------------------------------------------

function TopBar({ project, brand, onTitle, onChange, onRestore, onFlush, saveState, history, exporting, onExport, onPublished }) {
  const kind = KINDS[project.kind] ?? KINDS.carousel;
  const size = sizeOf(project);
  const multi = project.slides.length > 1;

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
          <kind.icon size={12} /> {kind.label} <span aria-hidden>·</span> {size.w} x {size.h}
        </span>
      </div>

      <SaveStatus state={saveState} />
      <div className="mx-1 hidden h-5 w-px bg-line sm:block" />
      <div className="hidden md:block">
        <ChecklistButton project={project} />
      </div>
      <HistoryButton project={project} brand={brand} onRestore={onRestore} onOpen={onFlush} />
      <ScheduleButton project={project} onChange={onChange} />
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
        items={[
          { label: "PNG image", hint: `This slide at ${size.w} x ${size.h}`, icon: ImageDown, onClick: () => onExport("png") },
          multi && { label: "All slides as PNG", hint: "ZIP archive, one file per slide", icon: FolderArchive, onClick: () => onExport("zip") },
          { label: "PDF document", hint: multi ? "Upload as a LinkedIn document post" : "High resolution, print ready", icon: FileText, onClick: () => onExport("pdf") },
          { label: "Platform bundle", hint: "Folders for LinkedIn, Instagram, X, Threads with captions", icon: Package, onClick: () => onExport("bundle") },
          "divider",
          { label: "Copy image", hint: "This slide, to your clipboard", icon: ClipboardCopy, onClick: () => onExport("copy") },
          { label: "Copy caption", hint: "Caption and hashtags", icon: Copy, onClick: () => onExport("caption") },
        ]}
      />
    </header>
  );
}

// ---- slide rail -------------------------------------------------------------

function SlideRail({ project, brand, active, onSelect, onAdd, onDuplicate, onDelete, onMove, horizontal }) {
  const [drag, setDrag] = useState(null); // { from, over }
  const thumbWidth = horizontal ? 84 : 148;
  const count = project.slides.length;

  return (
    <div className={horizontal ? "scrollbar-thin flex gap-3 overflow-x-auto border-t border-line bg-white p-3" : "scrollbar-thin flex h-full flex-col gap-3 overflow-y-auto p-4"}>
      {project.slides.map((slide, i) => {
        const isActive = i === active;
        const dropHere = drag && drag.over === i && drag.from !== i;
        return (
          <div
            key={slide.id}
            draggable={count > 1}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              setDrag({ from: i, over: i });
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (drag && drag.over !== i) setDrag({ ...drag, over: i });
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (drag && drag.from !== i) onMove(drag.from, i);
              setDrag(null);
            }}
            onDragEnd={() => setDrag(null)}
            className={`group relative flex shrink-0 gap-2 ${horizontal ? "flex-col" : "items-start"} ${drag?.from === i ? "opacity-40" : ""}`}
          >
            {!horizontal && <span className={`w-4 pt-1 text-right text-[11px] tabular-nums ${isActive ? "font-semibold text-ink" : "text-subtle"}`}>{i + 1}</span>}
            <button
              onClick={() => onSelect(i)}
              aria-label={`Slide ${i + 1}`}
              aria-current={isActive}
              className={`relative overflow-hidden rounded-md transition ${
                isActive ? "ring-2 ring-accent ring-offset-2 ring-offset-paper" : "ring-1 ring-line hover:ring-ink/25"
              } ${dropHere ? "outline-2 outline-offset-4 outline-dashed outline-ink/40" : ""}`}
            >
              <SlideFrame project={project} slide={slide} index={i} brand={brand} width={thumbWidth} />
            </button>
            {isActive && (
              <div className={`absolute ${horizontal ? "top-1 right-1" : "top-1 right-1"}`}>
                <Menu
                  width="w-44"
                  trigger={({ toggle }) => (
                    <button onClick={toggle} className="flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-ink shadow-card backdrop-blur hover:bg-white" aria-label="Slide actions">
                      <MoreHorizontal size={14} />
                    </button>
                  )}
                  items={[
                    { label: "Duplicate", icon: Copy, onClick: () => onDuplicate(i), disabled: count >= SLIDE_LIMIT },
                    { label: "Move up", icon: ArrowUp, onClick: () => onMove(i, i - 1), disabled: i === 0 },
                    { label: "Move down", icon: ArrowDown, onClick: () => onMove(i, i + 1), disabled: i === count - 1 },
                    "divider",
                    { label: "Delete slide", icon: Trash2, danger: true, onClick: () => onDelete(i), disabled: count <= 1 },
                  ]}
                />
              </div>
            )}
          </div>
        );
      })}
      {count < SLIDE_LIMIT && (
        <button
          onClick={() => onAdd(active)}
          className={`flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-dashed border-ink/15 text-xs font-medium text-muted transition hover:border-ink/30 hover:bg-white hover:text-ink ${
            horizontal ? "w-[84px] flex-col" : "ml-6 h-10"
          }`}
        >
          <Plus size={14} /> Add slide
        </button>
      )}
    </div>
  );
}

// ---- inspector panels -------------------------------------------------------

function Section({ title, children, action }) {
  return (
    <section className="border-b border-line px-5 py-5 last:border-0">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h3 className="text-xs font-semibold tracking-wide text-ink uppercase">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function StyleNotice({ onFix, label = "Clean up" }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
      <WandSparkles size={14} className="mt-px shrink-0" />
      <span className="flex-1">Contains em dashes or emojis, which the house style avoids.</span>
      <button onClick={onFix} className="shrink-0 font-semibold underline-offset-2 hover:underline">
        {label}
      </button>
    </div>
  );
}

function SlidePanel({ project, index, onSlide, onClean }) {
  const hasSources = (project.sources?.length ?? 0) > 0;
  const slide = project.slides[index];
  const limits = project.kind === "image" ? { headline: 70, body: 140 } : { headline: 60, body: 180 };
  const slideIssues = hasStyleIssues(slide.kicker) || hasStyleIssues(slide.headline) || hasStyleIssues(slide.body);

  return (
    <>
      <Section title={`Slide ${index + 1} of ${project.slides.length}`}>
        <div className="space-y-4">
          <div>
            <label className="field-label" htmlFor="kicker">
              Label <span className="text-subtle">(optional)</span>
            </label>
            <input
              id="kicker"
              className="input"
              value={slide.kicker}
              maxLength={40}
              placeholder="e.g. Step 1, New, Tip"
              onChange={(e) => onSlide({ kicker: e.target.value }, `kicker-${slide.id}`)}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label className="field-label mb-0" htmlFor="headline">
                Headline
              </label>
              <CharCount value={slide.headline} limit={limits.headline} />
            </div>
            <AutoTextarea
              id="headline"
              minRows={2}
              className="text-[15px] font-medium"
              value={slide.headline}
              placeholder="Write a clear, bold headline"
              onChange={(e) => onSlide({ headline: e.target.value }, `headline-${slide.id}`)}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label className="field-label mb-0" htmlFor="body">
                Body
              </label>
              <CharCount value={slide.body} limit={limits.body} />
            </div>
            <AutoTextarea
              id="body"
              minRows={3}
              value={slide.body}
              placeholder="Add a supporting line"
              onChange={(e) => onSlide({ body: e.target.value }, `body-${slide.id}`)}
            />
          </div>
          <SlideAI project={project} index={index} onApply={(patch) => onSlide(patch)} />
          {slideIssues && (
            <StyleNotice
              onFix={() => onSlide({ kicker: cleanText(slide.kicker), headline: cleanText(slide.headline), body: cleanText(slide.body) })}
            />
          )}
          {!slideIssues && projectHasStyleIssues(project) && <StyleNotice label="Clean all" onFix={onClean} />}
        </div>
      </Section>
      <Section title="Layout and media">
        <LayoutFields slide={slide} onSlide={onSlide} hasSources={hasSources} />
      </Section>
      {project.source?.idea && (
        <Section title="Idea">
          <div className="flex gap-2.5 rounded-lg bg-paper p-3">
            <Lightbulb size={15} className="mt-0.5 shrink-0 text-accent" />
            <div className="text-xs">
              <p className="font-medium text-ink">{project.source.idea.title}</p>
              <p className="mt-1 text-muted">{project.source.idea.angle}</p>
            </div>
          </div>
        </Section>
      )}
      <Section>
        <p className="text-xs leading-relaxed text-subtle">
          Tip: use <span className="kbd">{"←"}</span> <span className="kbd">{"→"}</span> to move between slides and{" "}
          <span className="kbd">{MOD_KEY} D</span> to duplicate one.
        </p>
      </Section>
    </>
  );
}

function DesignPanel({ project, index, brand, onDesign, onSize }) {
  const { design } = project;
  const customFonts = useCustomFonts();
  const fontOptions = [
    ["auto", { label: "Template", css: undefined }],
    ...Object.entries(FONTS),
    ...customFonts.map((f) => [CUSTOM_PREFIX + f.family, { label: f.family, css: customFontCss(f.family) }]),
  ];
  const slide = project.slides[index];
  const kind = KINDS[project.kind] ?? KINDS.carousel;
  const multi = project.slides.length > 1;

  return (
    <>
      <BrandKitSection project={project} onDesign={onDesign} />
      <Section title="Template">
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(TEMPLATES).map(([id, tpl]) => {
            const active = design.template === id;
            const preview = { ...project, size: "square", design: { ...design, template: id, showBrand: false, showArrow: false, showCta: false } };
            return (
              <button key={id} onClick={() => onDesign({ template: id })} className="group text-left" aria-pressed={active}>
                <span
                  className={`block overflow-hidden rounded-lg transition ${active ? "ring-2 ring-accent ring-offset-2" : "ring-1 ring-line group-hover:ring-ink/25"}`}
                >
                  <SlideFrame project={preview} slide={slide} index={index} brand={brand} width={138} />
                </span>
                <span className={`mt-1.5 flex items-center gap-1 text-xs ${active ? "font-medium text-ink" : "text-muted"}`}>
                  {active && <Check size={12} />} {tpl.label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Color">
        <ColorPicker value={design.accent} onChange={(accent) => onDesign({ accent }, "accent")} />
      </Section>

      <Section title="Headline font">
        <div className="grid grid-cols-2 gap-1.5">
          {fontOptions.map(([id, font]) => (
            <button
              key={id}
              onClick={() => onDesign({ font: id })}
              className={`h-10 truncate rounded-lg border px-3 text-left text-sm transition ${
                design.font === id ? "border-ink bg-white text-ink" : "border-line text-muted hover:border-ink/25 hover:text-ink"
              }`}
              style={{ fontFamily: font.css }}
            >
              {font.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Size">
        <div className="flex flex-col gap-1">
          {Object.values(SIZES).map((s) => {
            const active = project.size === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSize(s.id)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                  active ? "border-ink bg-white" : "border-transparent hover:bg-paper"
                }`}
              >
                <span className="text-ink">
                  {s.label} <span className="text-subtle">{s.ratio}</span>
                  {kind.sizes[0] === s.id && <span className="ml-1.5 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">Recommended</span>}
                </span>
                <span className="text-xs text-subtle tabular-nums">
                  {s.w} x {s.h}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Layout">
        <Segmented
          value={design.align}
          onChange={(align) => onDesign({ align })}
          options={[
            { value: "left", label: "Left", icon: AlignLeft },
            { value: "center", label: "Center", icon: AlignCenter },
          ]}
        />
        <div className="mt-3 divide-y divide-line">
          <Toggle label="Brand name and handle" checked={design.showBrand} onChange={(v) => onDesign({ showBrand: v })} />
          <Toggle label="Slide numbers" description={multi ? undefined : "Shown on multi-slide posts"} checked={design.showNumbers} onChange={(v) => onDesign({ showNumbers: v })} />
          <Toggle label="Swipe hint" description={multi ? undefined : "Shown on multi-slide posts"} checked={design.showArrow} onChange={(v) => onDesign({ showArrow: v })} />
          <Toggle label="Call to action" description="On the last slide" checked={design.showCta} onChange={(v) => onDesign({ showCta: v })} />
        </div>
      </Section>

      <Section title="My templates">
        <SavedTemplates project={project} onDesign={onDesign} />
      </Section>

      <Section>
        <button
          className="btn btn-secondary w-full"
          onClick={() =>
            onDesign({
              accent: brand.accent,
              font: brand.font,
              ...(brand.template !== "auto" ? { template: brand.template } : {}),
            })
          }
        >
          Apply brand kit
        </button>
      </Section>
    </>
  );
}

function BrandKitSection({ project, onDesign }) {
  const kits = useBrandKits();
  if (kits.length < 2) return null;
  return (
    <Section title="Brand kit">
      <BrandKitSelect project={project} onDesign={onDesign} />
    </Section>
  );
}

function PostPanel({ project, onChange, onAddSourcesSlide }) {
  return (
    <>
      <Section title="Captions">
        <CaptionsPanel project={project} onChange={onChange} />
      </Section>
      <Section title="Call to action">
        <input
          className="input"
          value={project.cta}
          maxLength={60}
          placeholder="e.g. Follow for more"
          onChange={(e) => onChange({ cta: e.target.value }, "cta")}
        />
        <p className="mt-2 text-xs text-subtle">Shown as a button on the last slide.</p>
        {hasStyleIssues(project.cta) && (
          <div className="mt-3">
            <StyleNotice onFix={() => onChange({ cta: cleanText(project.cta) })} />
          </div>
        )}
      </Section>
      <Section title="Research sources">
        <Sources project={project} onAddSlide={onAddSourcesSlide} />
      </Section>
    </>
  );
}

// ---- editor ------------------------------------------------------------------

const EXPORT_LABELS = { png: "PNG export", zip: "ZIP export", pdf: "PDF export", bundle: "Platform bundle export" };

const TABS = [
  { value: "slide", label: "Slide" },
  { value: "design", label: "Design" },
  { value: "post", label: "Post" },
  { value: "repurpose", label: "Repurpose" },
];

function Editor({ initial }) {
  const toast = useToast();
  const navigate = useNavigate();
  const history = useUndoable(initial);
  const { state: project, set } = history;
  const brand = useProjectBrand(project);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState("slide");
  const [exporting, setExporting] = useState(null);
  const wide = useMediaQuery("(min-width: 1024px)");

  const index = Math.min(active, project.slides.length - 1);
  const slide = project.slides[index];

  const { saveState, flush } = useAutosave(project, initial);

  // ---- mutations
  const update = useCallback((patch, group) => set((p) => ({ ...p, ...patch }), group), [set]);
  const updateDesign = useCallback((patch, group) => set((p) => ({ ...p, design: { ...p.design, ...patch } }), group), [set]);
  const updateSlide = useCallback(
    (patch, group) => set((p) => ({ ...p, slides: p.slides.map((s, i) => (i === index ? { ...s, ...patch } : s)) }), group),
    [set, index],
  );

  const addSlide = useCallback(
    (after) => {
      set((p) => {
        const slides = [...p.slides];
        slides.splice(after + 1, 0, makeSlide({ headline: "New slide", body: "" }));
        return { ...p, slides };
      });
      setActive(after + 1);
    },
    [set],
  );

  const duplicateSlide = useCallback(
    (i) => {
      set((p) => {
        if (p.slides.length >= SLIDE_LIMIT) return p;
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

  const addSourcesSlide = useCallback(() => {
    set((p) => ({ ...p, slides: [...p.slides, makeSlide({ layout: "sources", kicker: "Sources", headline: "Where this comes from" })] }));
    setActive(project.slides.length);
    setTab("slide");
  }, [set, project.slides.length]);

  function makeThumbnail(text) {
    const thumb = insertProject({
      title: `${project.title} thumbnail`,
      kind: "thumbnail",
      size: "youtube",
      design: { ...defaultDesign("thumbnail", brand, "bold"), brandKitId: project.design.brandKitId, accent: project.design.accent, showBrand: false },
      slides: [makeSlide({ headline: text })],
      caption: "",
      hashtags: [],
      cta: "",
      source: project.source,
    });
    toast("Thumbnail created");
    navigate(`/app/p/${thumb.id}`);
  }

  const restoreVersion = useCallback(
    (data) => {
      set((p) => ({ ...data, id: p.id, createdAt: p.createdAt, updatedAt: p.updatedAt }));
      setActive(0);
    },
    [set],
  );

  // ---- export
  async function handleExport(type) {
    if (type === "caption") {
      const text = [project.caption, formatHashtags(project.hashtags)].filter(Boolean).join("\n\n");
      try {
        await navigator.clipboard.writeText(text);
        toast("Caption copied");
      } catch {
        toast("Could not access the clipboard", { tone: "error" });
      }
      return;
    }
    setExporting(type);
    try {
      if (type === "png") await exportPng(project, brand, index);
      else if (type === "zip") await exportZip(project, brand);
      else if (type === "pdf") await exportPdf(project, brand);
      else if (type === "copy") await copyPng(project, brand, index);
      else if (type === "bundle") await exportBundle(project, brand);
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
    const entry = { platform: "instagram", url: permalink, at: posted_at };
    update({ published: [...(project.published ?? []), entry] });
    versions.create(project, "export", "Posted to Instagram").catch(() => {});
  }

  // ---- keyboard shortcuts
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
      } else if (isMod(e) && key === "d") {
        e.preventDefault();
        duplicateSlide(index);
      } else if (!isTyping(e) && (e.key === "ArrowRight" || e.key === "ArrowDown")) {
        e.preventDefault();
        setActive(Math.min(index + 1, project.slides.length - 1));
      } else if (!isTyping(e) && (e.key === "ArrowLeft" || e.key === "ArrowUp")) {
        e.preventDefault();
        setActive(Math.max(index - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history, flush, toast, duplicateSlide, index, project.slides.length]);

  const rail = (
    <SlideRail
      project={project}
      brand={brand}
      active={index}
      onSelect={setActive}
      onAdd={addSlide}
      onDuplicate={duplicateSlide}
      onDelete={deleteSlide}
      onMove={moveSlide}
      horizontal={!wide}
    />
  );

  return (
    <div className="flex min-h-dvh flex-col bg-paper lg:h-dvh">
      <TopBar
        project={project}
        brand={brand}
        onRestore={restoreVersion}
        onFlush={flush}
        onTitle={(title) => update({ title }, "title")}
        onChange={update}
        saveState={saveState}
        history={history}
        exporting={exporting}
        onExport={handleExport}
        onPublished={handlePublished}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {wide && <aside className="w-[200px] shrink-0 border-r border-line bg-paper">{rail}</aside>}

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="bg-dots relative flex h-[62vh] flex-col lg:h-auto lg:min-h-0 lg:flex-1">
            <FitSlide project={project} slide={slide} index={index} brand={brand} padding={wide ? 48 : 20} className="min-h-0 flex-1" frameClassName="rounded-sm shadow-pop" />
            <div className="flex items-center justify-center gap-2 pb-4">
              <button className="btn btn-secondary btn-icon" onClick={() => setActive(index - 1)} disabled={index === 0} aria-label="Previous slide">
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-16 text-center text-xs font-medium tabular-nums text-muted">
                {index + 1} / {project.slides.length}
              </span>
              <button
                className="btn btn-secondary btn-icon"
                onClick={() => setActive(index + 1)}
                disabled={index === project.slides.length - 1}
                aria-label="Next slide"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          {!wide && rail}
        </div>

        <aside className="flex w-full shrink-0 flex-col border-line bg-white lg:w-[340px] lg:border-l">
          <div className="border-b border-line p-3">
            <Segmented value={tab} onChange={setTab} options={TABS} />
          </div>
          <div className="scrollbar-thin lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {tab === "slide" && <SlidePanel project={project} index={index} onSlide={updateSlide} onClean={() => set((p) => cleanProjectCopy(p))} />}
            {tab === "design" && (
              <DesignPanel project={project} index={index} brand={brand} onDesign={updateDesign} onSize={(size) => update({ size })} />
            )}
            {tab === "post" && <PostPanel project={project} onChange={update} onAddSourcesSlide={addSourcesSlide} />}
            {tab === "repurpose" && (
              <Section title="Repurpose this post">
                <p className="mb-3 text-xs text-subtle">Turn these slides into other formats. Everything stays editable and saves with the project.</p>
                <RepurposePanel project={project} onChange={update} onMakeThumbnail={makeThumbnail} />
              </Section>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function EditorPage() {
  const { id } = useParams();
  const { status, items } = useProjectsState();
  const project = items.find((p) => p.id === id) ?? null;
  // Freeze the first loaded copy per project; the editor owns the state from then on.
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

  if (!initial) {
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
  if (initial.kind === "text") return <TextEditor key={id} initial={initial} />;
  return <Editor key={id} initial={initial} />;
}
