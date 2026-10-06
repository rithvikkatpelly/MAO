import { useRef, useState } from "react";
import { Ban, ImagePlus, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { IMAGE_ACCEPT, fileToImage, photoToDataUrl } from "../../lib/image";
import { SLIDE_ICONS } from "../../lib/slideIcons";
import { LAYOUTS } from "../../lib/templates";
import { useToast } from "../Toast";
import VisualPanel from "../visual/VisualPanel";

function PhotoPicker({ label, value, onChange, onRemove }) {
  const input = useRef(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function pick(file) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(photoToDataUrl(await fileToImage(file)));
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-ink/15 bg-paper hover:border-ink/30"
        aria-label={label}
      >
        {busy ? <Loader2 size={16} className="animate-spin text-subtle" /> : value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={17} className="text-subtle" />}
      </button>
      <div className="min-w-0 flex-1 text-xs">
        <button type="button" className="font-medium text-ink hover:underline" onClick={() => input.current?.click()}>
          {value ? "Replace" : label}
        </button>
        <p className="text-subtle">JPG, PNG, or WebP</p>
      </div>
      {value && (
        <button type="button" className="btn btn-ghost btn-icon" onClick={onRemove} aria-label="Remove image">
          <Trash2 size={14} />
        </button>
      )}
      <input ref={input} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

function RowList({ rows, onChange, render, max = 6, empty }) {
  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {render(row, i, (next) => onChange(rows.map((r, j) => (j === i ? next : r))))}
          <button type="button" className="btn btn-ghost btn-icon shrink-0" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove row">
            <Minus size={14} />
          </button>
        </div>
      ))}
      {rows.length < max && (
        <button type="button" className="btn btn-ghost h-8 px-2 text-xs" onClick={() => onChange([...rows, empty])}>
          <Plus size={13} /> Add
        </button>
      )}
    </div>
  );
}

// Layout picker plus the fields each layout needs, the icon, and the background photo.
export default function LayoutFields({ project, slide, onSlide, hasSources }) {
  const layout = slide.layout ?? "standard";

  return (
    <div className="space-y-5">
      <div>
        <p className="field-label">Layout</p>
        <div className="grid grid-cols-4 gap-1.5">
          {Object.entries(LAYOUTS).map(([id, l]) => (
            <button
              key={id}
              type="button"
              onClick={() => onSlide({ layout: id })}
              disabled={id === "sources" && !hasSources}
              title={id === "sources" && !hasSources ? "Generate with AI to get research sources" : undefined}
              className={`h-8 rounded-md border text-xs transition disabled:opacity-40 ${layout === id ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-ink/25 hover:text-ink"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {layout === "visual" && project && (
        <div className="-mx-5 border-y border-line">
          <VisualPanel project={project} slide={slide} onSlide={onSlide} />
        </div>
      )}

      {layout === "stat" && (
        <div>
          <label className="field-label" htmlFor="stat-value">
            Big number
          </label>
          <input id="stat-value" className="input text-lg font-semibold" maxLength={12} placeholder="e.g. 73%" value={slide.stat?.value ?? ""} onChange={(e) => onSlide({ stat: { ...slide.stat, value: e.target.value } }, `stat-${slide.id}`)} />
          <p className="mt-1.5 text-xs text-subtle">The headline becomes the label under the number.</p>
        </div>
      )}

      {layout === "list" && (
        <div>
          <p className="field-label">List items</p>
          <RowList
            rows={slide.items ?? []}
            empty=""
            onChange={(items) => onSlide({ items }, `items-${slide.id}`)}
            render={(row, i, set) => <input className="input" value={row} maxLength={120} placeholder={`Item ${i + 1}`} onChange={(e) => set(e.target.value)} />}
          />
        </div>
      )}

      {layout === "chart" && (
        <div>
          <p className="field-label">Bars</p>
          <RowList
            rows={slide.chart?.rows ?? []}
            empty={{ label: "", value: "" }}
            onChange={(rows) => onSlide({ chart: { ...slide.chart, rows } }, `chart-${slide.id}`)}
            render={(row, i, set) => (
              <>
                <input className="input" value={row.label} maxLength={40} placeholder={`Label ${i + 1}`} onChange={(e) => set({ ...row, label: e.target.value })} />
                <input className="input w-24 shrink-0" value={row.value} inputMode="decimal" placeholder="Value" onChange={(e) => set({ ...row, value: e.target.value.replace(/[^\d.-]/g, "") })} />
              </>
            )}
          />
          <label className="field-label mt-3" htmlFor="chart-suffix">
            Value suffix
          </label>
          <input id="chart-suffix" className="input" maxLength={6} placeholder="e.g. % or k" value={slide.chart?.suffix ?? ""} onChange={(e) => onSlide({ chart: { ...slide.chart, suffix: e.target.value } }, `suffix-${slide.id}`)} />
        </div>
      )}

      {layout === "code" && (
        <div>
          <label className="field-label" htmlFor="code">
            Code
          </label>
          <textarea id="code" className="input resize-y font-mono text-xs" rows={8} maxLength={1500} spellCheck={false} value={slide.code ?? ""} onChange={(e) => onSlide({ code: e.target.value }, `code-${slide.id}`)} />
        </div>
      )}

      {layout === "image" && (
        <div>
          <p className="field-label">Screenshot or image</p>
          <PhotoPicker label="Upload a screenshot" value={slide.image} onChange={(image) => onSlide({ image })} onRemove={() => onSlide({ image: "" })} />
        </div>
      )}

      {layout === "sources" && <p className="text-xs text-subtle">Shows the research sources behind this post. Edit the title in the headline field.</p>}

      <div>
        <p className="field-label">Icon</p>
        <div className="grid grid-cols-9 gap-1">
          <button
            type="button"
            onClick={() => onSlide({ icon: "" })}
            className={`flex h-8 items-center justify-center rounded-md border transition ${!slide.icon ? "border-ink bg-ink text-white" : "border-line text-subtle hover:border-ink/25"}`}
            aria-label="No icon"
          >
            <Ban size={14} />
          </button>
          {Object.entries(SLIDE_ICONS).map(([id, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => onSlide({ icon: id })}
              className={`flex h-8 items-center justify-center rounded-md border transition ${slide.icon === id ? "border-ink bg-ink text-white" : "border-line text-muted hover:border-ink/25 hover:text-ink"}`}
              aria-label={id}
              title={id}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="field-label">Background photo</p>
        <PhotoPicker label="Add a background photo" value={slide.bg?.src} onChange={(src) => onSlide({ bg: { dim: 0.45, ...slide.bg, src } })} onRemove={() => onSlide({ bg: null })} />
        {slide.bg?.src && (
          <label className="mt-3 flex items-center gap-3 text-xs text-muted">
            Darken
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.05"
              value={slide.bg.dim ?? 0.45}
              onChange={(e) => onSlide({ bg: { ...slide.bg, dim: Number(e.target.value) } }, `dim-${slide.id}`)}
              className="flex-1 accent-[var(--color-accent)]"
            />
          </label>
        )}
      </div>
    </div>
  );
}
