import { useMemo, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { SlideFrame } from "../../components/SlideFrame";
import { ColorPicker, TagInput } from "../../components/controls";
import { useToast } from "../../components/Toast";
import { makeSlide } from "../../lib/project";
import { DEFAULT_BRAND, saveBrand, useBrand } from "../../lib/storage";
import { FONTS, TEMPLATES } from "../../lib/templates";

const SAMPLE_SLIDES = [
  makeSlide({ kicker: "Your brand", headline: "This is how your posts will look", body: "Colors, fonts, and your name carry across every slide you make." }),
  makeSlide({ kicker: "Tip", headline: "Consistency builds recognition", body: "People remember a look before they remember a name." }),
];

function Field({ label, hint, children, htmlFor }) {
  return (
    <div>
      <label className="text-sm font-medium text-ink" htmlFor={htmlFor}>
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-subtle">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

export default function BrandPage() {
  const saved = useBrand();
  const toast = useToast();
  const [draft, setDraft] = useState(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const preview = useMemo(
    () => ({
      kind: "carousel",
      size: "portrait",
      cta: "Follow for more",
      slides: SAMPLE_SLIDES,
      design: {
        template: draft.template === "auto" ? "midnight" : draft.template,
        accent: draft.accent,
        font: draft.font,
        align: "left",
        showBrand: true,
        showNumbers: true,
        showArrow: true,
        showCta: true,
      },
    }),
    [draft],
  );

  function handleSave() {
    if (saveBrand(draft)) toast("Brand kit saved");
    else toast("Could not save. Browser storage is full or blocked.", { tone: "error" });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Brand kit</h1>
          <p className="mt-1 text-sm text-muted">Set your look once. New projects start with these settings.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => setDraft(DEFAULT_BRAND)} title="Restore defaults">
            <RotateCcw size={14} /> Reset
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!dirty}>
            {dirty ? "Save changes" : (
              <>
                <Check size={15} /> Saved
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_420px]">
        <div className="card divide-y divide-line">
          <div className="grid gap-6 p-6 sm:grid-cols-2">
            <Field label="Brand name" htmlFor="brand-name">
              <input id="brand-name" className="input" value={draft.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Handle" htmlFor="brand-handle">
              <input id="brand-handle" className="input" value={draft.handle} maxLength={40} placeholder="@yourhandle" onChange={(e) => set({ handle: e.target.value })} />
            </Field>
          </div>

          <div className="p-6">
            <Field label="Brand color" hint="Used for highlights, buttons, and accent backgrounds.">
              <ColorPicker value={draft.accent} onChange={(accent) => set({ accent })} />
            </Field>
          </div>

          <div className="p-6">
            <Field label="Default template">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {[["auto", { label: "Let AI choose" }], ...Object.entries(TEMPLATES)].map(([id, t]) => (
                  <button
                    key={id}
                    onClick={() => set({ template: id })}
                    className={`rounded-lg border px-2 py-2 text-xs transition ${
                      draft.template === id ? "border-ink bg-white font-medium text-ink ring-1 ring-ink" : "border-line text-muted hover:border-ink/25 hover:text-ink"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="p-6">
            <Field label="Headline font">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[["auto", { label: "Template", css: undefined }], ...Object.entries(FONTS)].map(([id, font]) => (
                  <button
                    key={id}
                    onClick={() => set({ font: id })}
                    style={{ fontFamily: font.css }}
                    className={`h-10 truncate rounded-lg border px-2 text-[13px] whitespace-nowrap transition ${
                      draft.font === id ? "border-ink bg-white text-ink ring-1 ring-ink" : "border-line text-muted hover:border-ink/25 hover:text-ink"
                    }`}
                  >
                    {font.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="p-6">
            <Field label="Default hashtags" hint="Added to every new project. You can remove them per post.">
              <TagInput value={draft.hashtags} onChange={(hashtags) => set({ hashtags })} />
            </Field>
          </div>
        </div>

        <div className="lg:sticky lg:top-10 lg:self-start">
          <p className="field-label">Preview</p>
          <div className="bg-dots flex justify-center gap-4 rounded-2xl border border-line p-6">
            {SAMPLE_SLIDES.map((slide, i) => (
              <SlideFrame key={slide.id} project={preview} slide={slide} index={i} brand={draft} width={176} className="rounded-sm shadow-pop" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
