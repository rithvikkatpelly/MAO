import { useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Trash2, UserRound } from "lucide-react";
import { IMAGE_ACCEPT, avatarToDataUrl, fileToImage, logoToDataUrl } from "../lib/image";
import { extractPalette } from "../lib/palette";
import { ColorPicker } from "./controls";

// Drop zone for a logo or profile photo. Calls onChange({ dataUrl, palette? }).
export function ImageDrop({ kind, value, onChange, onRemove }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isLogo = kind === "logo";

  async function handle(file) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const img = await fileToImage(file);
      if (isLogo) onChange({ dataUrl: logoToDataUrl(img), palette: extractPalette(img) });
      else onChange({ dataUrl: avatarToDataUrl(img) });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        className={`group relative flex cursor-pointer items-center gap-4 rounded-xl border border-dashed p-4 transition ${
          over ? "border-accent bg-accent/5" : "border-ink/15 bg-white hover:border-ink/30"
        }`}
      >
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden bg-paper ${
            isLogo ? "h-16 w-24 rounded-lg bg-[conic-gradient(#f1f0ec_25%,#fff_0_50%,#f1f0ec_0_75%,#fff_0)] bg-[length:12px_12px]" : "h-16 w-16 rounded-full"
          }`}
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin text-subtle" />
          ) : value ? (
            <img src={value} alt="" className={isLogo ? "max-h-14 max-w-20 object-contain" : "h-full w-full object-cover"} />
          ) : isLogo ? (
            <ImagePlus size={20} className="text-subtle" />
          ) : (
            <UserRound size={22} className="text-subtle" />
          )}
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium text-ink">{value ? "Replace image" : isLogo ? "Upload your logo" : "Upload a profile photo"}</p>
          <p className="text-xs text-subtle">
            {isLogo ? "PNG or SVG with a transparent background works best" : "A clear, square photo of your face"}
          </p>
        </div>
        {value && onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="btn btn-ghost btn-icon"
            aria-label="Remove image"
          >
            <Trash2 size={15} />
          </button>
        )}
        <input ref={input} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Colors pulled from the logo, plus a custom picker for the primary color.
export function BrandColors({ palette, accent, secondary, onChange }) {
  return (
    <div className="space-y-5">
      {palette.length > 0 && (
        <div>
          <p className="field-label">From your logo</p>
          <div className="flex flex-wrap gap-2">
            {palette.map((c) => {
              const role = c === accent ? "Primary" : c === secondary ? "Secondary" : null;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange(c === accent ? { accent: c } : c === secondary ? { secondary: "" } : { secondary: accent, accent: c })}
                  className={`group flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs transition ${
                    role ? "border-ink bg-white" : "border-line bg-white hover:border-ink/25"
                  }`}
                  title="Click to make this your primary color"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-black/10" style={{ background: c }}>
                    {role === "Primary" && <Check size={12} strokeWidth={3} className="text-white mix-blend-difference" />}
                  </span>
                  <span className="font-mono text-muted uppercase">{c}</span>
                  {role && <span className="font-medium text-ink">{role}</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-subtle">Click a color to make it primary. The previous primary becomes your secondary color.</p>
        </div>
      )}
      <div>
        <p className="field-label">Primary color</p>
        <ColorPicker value={accent} onChange={(c) => onChange({ accent: c })} />
      </div>
    </div>
  );
}

const MARKS = [
  { id: "logo", label: "Logo" },
  { id: "avatar", label: "Photo" },
  { id: "initials", label: "Initials" },
];

// What appears in the corner of every slide.
export function MarkChooser({ brand, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MARKS.map((m) => {
        const available = m.id === "initials" || brand[m.id];
        const active = brand.mark === m.id;
        return (
          <button
            key={m.id}
            type="button"
            disabled={!available}
            onClick={() => onChange(m.id)}
            className={`flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-xs transition disabled:opacity-40 ${
              active ? "border-ink bg-white font-medium text-ink ring-1 ring-ink" : "border-line bg-white text-muted hover:border-ink/25"
            }`}
            title={available ? undefined : `Upload a ${m.id === "logo" ? "logo" : "photo"} first`}
          >
            {m.id === "logo" && brand.logo ? (
              <img src={brand.logo} alt="" className="h-7 max-w-16 object-contain" />
            ) : m.id === "avatar" && brand.avatar ? (
              <img src={brand.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ background: brand.accent }}>
                {(brand.name || "A").slice(0, 1).toUpperCase()}
              </span>
            )}
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
