import { memo, useState } from "react";
import { ArrowDown, ArrowUp, Check, Loader2, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { useToast } from "../Toast";
import { AutoTextarea, Segmented } from "../controls";
import { visuals as visualsApi } from "../../lib/api";
import { SLIDE_ICONS } from "../../lib/slideIcons";
import { themeFor } from "../../lib/templates";
import { VisualBlock } from "../../lib/visuals";
import { PALETTES, VISUAL_TYPES, VISUAL_TYPE_IDS, convertVisual, normalizeVisual, starterVisual, visualText } from "../../lib/visualTypes";

// The diagram box a project gives its visuals, used to render previews at the right shape.
function previewBox(project) {
  if (project.kind === "deck") return { w: 1776, h: 640 };
  return { w: 904, h: 760 };
}

// A diagram rendered at full size and scaled down, on the project's template background.
export const VisualPreview = memo(function VisualPreview({ visual, project, width }) {
  const { design, t, headFont } = themeFor(project);
  const box = previewBox(project);
  const pad = 40;
  const scale = width / (box.w + pad * 2);
  const bg = t.grid ? t.bg : [...(t.layers ?? []), t.bg].join(", ");
  return (
    <div style={{ width, height: (box.h + pad * 2) * scale, overflow: "hidden", position: "relative" }}>
      <div style={{ width: box.w + pad * 2, height: box.h + pad * 2, padding: pad, boxSizing: "border-box", background: bg, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <VisualBlock visual={visual} t={t} accent={design.accent} w={box.w} h={box.h} headFont={headFont} />
      </div>
    </div>
  );
});

function Section({ title, action, children }) {
  return (
    <section className="border-b border-line px-5 py-5 last:border-b-0">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-xs font-semibold tracking-wide text-ink uppercase">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Tile({ active, onClick, label, badge, children }) {
  return (
    <button type="button" onClick={onClick} className="group text-left" aria-pressed={active}>
      <span className={`block overflow-hidden rounded-lg transition ${active ? "ring-2 ring-accent ring-offset-2" : "ring-1 ring-line group-hover:ring-ink/25"}`}>{children}</span>
      <span className={`mt-1.5 flex items-center gap-1 text-xs ${active ? "font-medium text-ink" : "text-muted"}`}>
        {active && <Check size={12} />} {label}
        {badge && <span className="ml-auto rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">{badge}</span>}
      </span>
    </button>
  );
}

function IconPicker({ value, onChange, onClose }) {
  return (
    <div className="mt-2 grid grid-cols-8 gap-1 rounded-lg border border-line bg-white p-2">
      {Object.entries(SLIDE_ICONS).map(([key, Icon]) => (
        <button
          key={key}
          type="button"
          title={key}
          onClick={() => {
            onChange(key);
            onClose();
          }}
          className={`flex h-8 items-center justify-center rounded-md transition ${value === key ? "bg-ink text-white" : "text-muted hover:bg-paper hover:text-ink"}`}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}

function ItemEditor({ item, index, meta, total, onChange, onMove, onRemove, canRemove }) {
  const [picking, setPicking] = useState(false);
  const Icon = SLIDE_ICONS[item.icon] ?? SLIDE_ICONS.check;
  const set = (patch) => onChange({ ...item, ...patch });
  return (
    <div className="rounded-xl border border-line bg-white p-2.5">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => setPicking((v) => !v)} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition ${picking ? "border-ink" : "border-line hover:border-ink/25"}`} title="Change icon" aria-label="Change icon">
          <Icon size={15} className="text-ink" />
        </button>
        {meta.value && (
          <input className="input h-8 w-24 shrink-0 px-2 py-1 text-sm" value={item.value} placeholder={meta.value} maxLength={16} onChange={(e) => set({ value: e.target.value })} aria-label={meta.value} />
        )}
        <input className="input h-8 min-w-0 flex-1 px-2 py-1 text-sm font-medium" value={item.label} placeholder="Label" maxLength={60} onChange={(e) => set({ label: e.target.value })} aria-label="Label" />
        <div className="flex shrink-0">
          <button type="button" className="btn btn-ghost h-7 w-6 px-0" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up">
            <ArrowUp size={13} />
          </button>
          <button type="button" className="btn btn-ghost h-7 w-6 px-0" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move down">
            <ArrowDown size={13} />
          </button>
          <button type="button" className="btn btn-ghost h-7 w-6 px-0" onClick={onRemove} disabled={!canRemove} aria-label="Remove item">
            <X size={13} />
          </button>
        </div>
      </div>
      {picking && <IconPicker value={item.icon} onChange={(icon) => set({ icon })} onClose={() => setPicking(false)} />}
      {meta.id !== "bars" && (
        <AutoTextarea className="input mt-1.5 px-2 py-1.5 text-xs" minRows={1} value={item.detail} placeholder="Supporting detail (optional)" maxLength={160} onChange={(e) => set({ detail: e.target.value })} />
      )}
    </div>
  );
}

function ItemList({ visual, items, meta, onItems, group }) {
  const all = visual.items;
  const indices = all.map((item, i) => ({ item, i })).filter(({ item }) => group === undefined || (item.group ? 1 : 0) === group);
  const max = group === undefined ? meta.max : Math.ceil(meta.max / 2);
  const min = group === undefined ? meta.min : 1;
  const replace = (i, next) => onItems(all.map((it, j) => (j === i ? next : it)));
  const move = (pos, dir) => {
    const target = indices[pos + dir];
    if (!target) return;
    const next = [...all];
    [next[indices[pos].i], next[target.i]] = [next[target.i], next[indices[pos].i]];
    onItems(next);
  };
  return (
    <div className="space-y-2">
      {indices.map(({ item, i }, pos) => (
        <ItemEditor
          key={i}
          item={item}
          index={pos}
          total={indices.length}
          meta={meta}
          onChange={(next) => replace(i, next)}
          onMove={(dir) => move(pos, dir)}
          onRemove={() => onItems(all.filter((_, j) => j !== i))}
          canRemove={indices.length > min && all.length > meta.min}
        />
      ))}
      {indices.length < max && all.length < meta.max && (
        <button
          type="button"
          className="btn btn-ghost h-8 w-full border border-dashed border-line text-xs"
          onClick={() => onItems([...all, { label: "New point", detail: "", value: "", icon: "check", group: group ?? 0 }])}
        >
          <Plus size={13} /> Add {items}
        </button>
      )}
    </div>
  );
}

// Everything about one slide's diagram: choose or switch type, variant, colors, content, and AI.
export default function VisualPanel({ project, slide, onSlide }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null); // "visualize" | "regenerate"
  const visual = slide.visual ? normalizeVisual(slide.visual) : null;
  const source = project.source?.text ?? ""; // the pasted text an infographic was made from
  const text = [slide.headline, slide.body].filter(Boolean).join(". ") || source.slice(0, 3000);

  const setVisual = (next, group) => onSlide({ visual: next, layout: "visual" }, group);

  async function runAI(kind) {
    if (text.trim().length < 3 && kind === "visualize") {
      toast("Add a headline or some text first, then visualize it.", { tone: "error" });
      return;
    }
    setBusy(kind);
    try {
      const facts = source.slice(0, 6000);
      const body = kind === "regenerate" ? { text: `${text}. ${visualText(visual)}`.slice(0, 3000), type: visual.type, facts } : { text: text.slice(0, 3000), facts };
      const { visual: made } = await visualsApi.visualize(body);
      setVisual({ ...normalizeVisual(made), style: visual?.style ?? { palette: "brand" } });
      toast(kind === "regenerate" ? "Diagram rewritten" : "Diagram created");
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (!visual) {
    return (
      <>
        <Section>
          <p className="text-sm text-muted">Turn this {project.kind === "infographic" ? "page" : "slide"} into a diagram. AI reads the text and picks the shape that fits, or choose one yourself.</p>
          <button type="button" className="btn btn-accent mt-4 w-full" onClick={() => runAI("visualize")} disabled={!!busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Visualize with AI
          </button>
        </Section>
        <Section title="Or pick a diagram">
          <div className="grid grid-cols-2 gap-3">
            {VISUAL_TYPE_IDS.map((type) => (
              <Tile key={type} label={VISUAL_TYPES[type].label} onClick={() => setVisual(starterVisual(type))}>
                <VisualPreview visual={starterVisual(type)} project={project} width={138} />
              </Tile>
            ))}
          </div>
        </Section>
      </>
    );
  }

  const meta = { ...VISUAL_TYPES[visual.type], id: visual.type };
  const suggested = new Set(visual.alternates);
  const order = [visual.type, ...visual.alternates, ...VISUAL_TYPE_IDS.filter((t) => t !== visual.type && !suggested.has(t))];
  const onItems = (items) => setVisual({ ...visual, items }, "items");

  return (
    <>
      <Section
        title="Diagram"
        action={
          <div className="flex gap-1">
            <button type="button" className="btn btn-ghost h-7 px-2 text-xs" onClick={() => runAI("regenerate")} disabled={!!busy} title="Rewrite this diagram's content with AI">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Rewrite
            </button>
            <button type="button" className="btn btn-ghost h-7 px-2 text-xs" onClick={() => onSlide({ visual: null, layout: "standard" })} title="Remove the diagram">
              <Trash2 size={13} /> Remove
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {order.map((type) => {
            const preview = type === visual.type ? visual : convertVisual(visual, type);
            return (
              <Tile key={type} active={type === visual.type} badge={suggested.has(type) ? "Suggested" : null} label={VISUAL_TYPES[type].label} onClick={() => type !== visual.type && setVisual(convertVisual(visual, type))}>
                <VisualPreview visual={preview} project={project} width={138} />
              </Tile>
            );
          })}
        </div>
      </Section>

      <Section title="Style">
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(meta.variants).map(([id, label]) => (
            <Tile key={id} active={visual.variant === id} label={label} onClick={() => setVisual({ ...visual, variant: id })}>
              <VisualPreview visual={{ ...visual, variant: id }} project={project} width={88} />
            </Tile>
          ))}
        </div>
        <p className="field-label mt-4">Colors</p>
        <Segmented
          size="sm"
          value={visual.style.palette}
          onChange={(palette) => setVisual({ ...visual, style: { ...visual.style, palette } })}
          options={Object.entries(PALETTES).map(([value, label]) => ({ value, label }))}
        />
      </Section>

      <Section title="Content">
        {meta.extra && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            {Object.entries(meta.extra).map(([key, label]) => (
              <label key={key} className={key === "center" || key === "overlap" ? "col-span-2" : ""}>
                <span className="field-label">{label}</span>
                <input
                  className="input h-8 px-2 py-1 text-sm"
                  value={visual.extra[key] ?? ""}
                  maxLength={key === "suffix" ? 4 : 50}
                  onChange={(e) => setVisual({ ...visual, extra: { ...visual.extra, [key]: e.target.value } }, `extra-${key}`)}
                />
              </label>
            ))}
          </div>
        )}
        {meta.groups ? (
          <div className="space-y-4">
            {[0, 1].map((g) => (
              <div key={g}>
                <p className="field-label">{visual.extra[g ? "right" : "left"] || (g ? "Right side" : "Left side")}</p>
                <ItemList visual={visual} items="point" meta={meta} onItems={onItems} group={g} />
              </div>
            ))}
          </div>
        ) : (
          <ItemList visual={visual} items={meta.value ? "row" : "item"} meta={meta} onItems={onItems} />
        )}
        <p className="mt-3 text-xs text-subtle">
          {meta.label}: {meta.min === meta.max ? `exactly ${meta.min}` : `${meta.min} to ${meta.max}`} items.
        </p>
      </Section>
    </>
  );
}
