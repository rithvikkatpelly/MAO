import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ClipboardList, Copy, FileUp, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { BrandColors, ImageDrop, MarkChooser } from "../../components/brand";
import { ConfirmDialog } from "../../components/Dialog";
import { SlideFrame } from "../../components/SlideFrame";
import { ChoiceChips, Segmented, TagInput } from "../../components/controls";
import { useToast } from "../../components/Toast";
import { updateProfile, useAuth } from "../../lib/auth";
import { PRIMARY_KIT, useBrandKits } from "../../lib/brandkits";
import { CUSTOM_PREFIX, FONT_ACCEPT, customFontCss, fontFileToItem, useCustomFonts } from "../../lib/fonts";
import { deleteItem, saveItem } from "../../lib/items";
import { makeSlide } from "../../lib/project";
import { DEFAULT_BRAND, saveBrand } from "../../lib/storage";
import { FONTS, TEMPLATES } from "../../lib/templates";

const SAMPLE_SLIDES = [
  makeSlide({ kicker: "Your brand", headline: "This is how your posts will look", body: "Colors, fonts, and your name carry across every slide you make." }),
  makeSlide({ kicker: "Tip", headline: "Consistency builds recognition", body: "People remember a look before they remember a name." }),
];
const TONES = ["Professional", "Friendly", "Bold", "Playful", "Inspirational", "Educational"];

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

function strip(kit) {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = kit;
  return rest;
}

// ---- look: one or more brand kits -----------------------------------------------------

function LookTab() {
  const toast = useToast();
  const kits = useBrandKits();
  const customFonts = useCustomFonts();
  const [kitId, setKitId] = useState(PRIMARY_KIT);
  const kit = kits.find((k) => k.id === kitId) ?? kits[0];
  const [draft, setDraft] = useState(kit);
  const [synced, setSynced] = useState({ id: kit.id, kit });
  if (synced.id !== kit.id || synced.kit !== kit) {
    // Switched kits, or the saved kit changed underneath us: start from the saved version.
    setSynced({ id: kit.id, kit });
    setDraft(kit);
  }
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPrimary = kit.id === PRIMARY_KIT;
  const dirty = JSON.stringify(strip(draft)) !== JSON.stringify(strip(kit));
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const preview = useMemo(
    () => ({
      kind: "carousel",
      size: "portrait",
      cta: "Follow for more",
      slides: SAMPLE_SLIDES,
      design: { template: draft.template === "auto" ? "midnight" : draft.template, accent: draft.accent, font: draft.font, align: "left", showBrand: true, showNumbers: true, showArrow: true, showCta: true },
    }),
    [draft],
  );

  async function handleSave() {
    setSaving(true);
    try {
      if (isPrimary) {
        const { kit_name: _k, ...brand } = strip(draft);
        if (!(await saveBrand(brand))) throw new Error("Could not save your brand kit. Please try again.");
      } else {
        await saveItem("brand_kit", { ...strip(draft), id: kit.id });
      }
      toast("Brand kit saved");
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function newKit(from) {
    try {
      const created = await saveItem("brand_kit", {
        ...DEFAULT_BRAND,
        ...(from ? strip(from) : {}),
        kit_name: from ? `${from.kit_name} copy` : `Brand ${kits.length + 1}`,
      });
      setKitId(created.id);
    } catch (err) {
      toast(err.message, { tone: "error" });
    }
  }

  const fontOptions = [["auto", { label: "Template" }], ...Object.entries(FONTS), ...customFonts.map((f) => [CUSTOM_PREFIX + f.family, { label: f.family, css: customFontCss(f.family) }])];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {kits.map((k) => (
          <button
            key={k.id}
            onClick={() => setKitId(k.id)}
            className={`flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition ${k.id === kit.id ? "border-ink bg-white text-ink" : "border-line text-muted hover:border-ink/25"}`}
          >
            <span className="h-6 w-6 rounded-full ring-1 ring-black/10" style={{ background: k.accent }} />
            {k.kit_name}
          </button>
        ))}
        <button className="btn btn-ghost h-8 px-2.5 text-xs" onClick={() => newKit(null)}>
          <Plus size={13} /> New kit
        </button>
      </div>
      <p className="mt-2 text-xs text-subtle">Extra kits are for clients or side brands. Pick a kit per project in the editor's Design tab.</p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_420px]">
        <div className="card divide-y divide-line">
          {!isPrimary && (
            <div className="p-6">
              <Field label="Kit name" htmlFor="kit-name">
                <input id="kit-name" className="input" value={draft.kit_name} maxLength={60} onChange={(e) => set({ kit_name: e.target.value })} />
              </Field>
            </div>
          )}
          <div className="grid gap-6 p-6 sm:grid-cols-2">
            <Field label="Brand name" htmlFor="brand-name">
              <input id="brand-name" className="input" value={draft.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Handle" htmlFor="brand-handle">
              <input id="brand-handle" className="input" value={draft.handle} maxLength={40} placeholder="@yourhandle" onChange={(e) => set({ handle: e.target.value })} />
            </Field>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-2">
            <Field label="Logo">
              <ImageDrop
                kind="logo"
                value={draft.logo}
                onChange={({ dataUrl, palette }) => set({ logo: dataUrl, palette, accent: palette[0] ?? draft.accent, secondary: palette[1] ?? "", mark: "logo" })}
                onRemove={() => set({ logo: "", palette: [], mark: draft.mark === "logo" ? (draft.avatar ? "avatar" : "initials") : draft.mark })}
              />
            </Field>
            <Field label="Profile photo or headshot">
              <ImageDrop kind="avatar" value={draft.avatar} onChange={({ dataUrl }) => set({ avatar: dataUrl })} onRemove={() => set({ avatar: "", mark: draft.mark === "avatar" ? "initials" : draft.mark })} />
            </Field>
          </div>

          <div className="p-6">
            <Field label="Show on your slides">
              <MarkChooser brand={draft} onChange={(mark) => set({ mark })} />
            </Field>
          </div>

          <div className="p-6">
            <Field label="Brand colors" hint="Used for highlights, buttons, and accent backgrounds.">
              <BrandColors palette={draft.palette} accent={draft.accent} secondary={draft.secondary} onChange={set} />
            </Field>
          </div>

          <div className="p-6">
            <Field label="Default template">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {[["auto", { label: "Let AI choose" }], ...Object.entries(TEMPLATES)].map(([id, t]) => (
                  <button
                    key={id}
                    onClick={() => set({ template: id })}
                    className={`rounded-lg border px-2 py-2 text-xs transition ${draft.template === id ? "border-ink bg-white font-medium text-ink ring-1 ring-ink" : "border-line text-muted hover:border-ink/25 hover:text-ink"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="p-6">
            <Field label="Headline font" hint="Upload your own in the Fonts tab.">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {fontOptions.map(([id, font]) => (
                  <button
                    key={id}
                    onClick={() => set({ font: id })}
                    style={{ fontFamily: font.css }}
                    className={`h-10 truncate rounded-lg border px-2 text-[13px] whitespace-nowrap transition ${draft.font === id ? "border-ink bg-white text-ink ring-1 ring-ink" : "border-line text-muted hover:border-ink/25 hover:text-ink"}`}
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

          <div className="flex flex-wrap gap-2 p-6">
            <button className="btn btn-primary" onClick={handleSave} disabled={!dirty || saving}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : !dirty ? <Check size={15} /> : null}
              {dirty ? "Save changes" : "Saved"}
            </button>
            <button className="btn btn-ghost" onClick={() => setDraft({ ...draft, ...DEFAULT_BRAND, name: draft.name, handle: draft.handle, logo: draft.logo, avatar: draft.avatar, mark: draft.mark, palette: draft.palette })}>
              <RotateCcw size={14} /> Reset styles
            </button>
            <button className="btn btn-ghost" onClick={() => newKit(draft)}>
              <Copy size={14} /> Duplicate as new kit
            </button>
            {!isPrimary && (
              <button className="btn btn-ghost text-red-600 hover:bg-red-50 sm:ml-auto" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> Delete kit
              </button>
            )}
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

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${kit.kit_name}?`}
        description="Projects using this kit switch to your primary kit."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          try {
            await deleteItem("brand_kit", kit.id);
            setKitId(PRIMARY_KIT);
          } catch (err) {
            toast(err.message, { tone: "error" });
          }
        }}
      />
    </>
  );
}

// ---- voice: what the AI writes like ---------------------------------------------------

function VoiceTab() {
  const { profile } = useAuth();
  const toast = useToast();
  const saved = profile?.social ?? {};
  const [draft, setDraft] = useState(() => ({ niche: "", tone: "", audience: "", avoid_words: [], example_posts: [], ...saved }));
  const [saving, setSaving] = useState(false);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = JSON.stringify(draft) !== JSON.stringify({ niche: "", tone: "", audience: "", avoid_words: [], example_posts: [], ...saved });

  async function save() {
    setSaving(true);
    try {
      await updateProfile({ social: { ...saved, ...draft, example_posts: draft.example_posts.map((p) => p.trim()).filter(Boolean) } });
      toast("Voice saved. New drafts will use it.");
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  const examples = [...draft.example_posts, "", "", ""].slice(0, 3);

  return (
    <div className="card max-w-3xl divide-y divide-line">
      <div className="p-6">
        <p className="text-sm text-muted">Everything here is sent to the AI with every draft, rewrite, and caption.</p>
      </div>
      <div className="p-6">
        <Field label="Niche" htmlFor="niche" hint="What you post about, in a few words.">
          <input id="niche" className="input" maxLength={120} placeholder="e.g. personal finance for freelancers" value={draft.niche} onChange={(e) => set({ niche: e.target.value })} />
        </Field>
      </div>
      <div className="p-6">
        <Field label="Tone">
          <ChoiceChips options={TONES} value={draft.tone} onChange={(tone) => set({ tone })} />
        </Field>
      </div>
      <div className="p-6">
        <Field label="Audience" htmlFor="audience">
          <textarea id="audience" className="input resize-none" rows={2} maxLength={300} value={draft.audience} onChange={(e) => set({ audience: e.target.value })} />
        </Field>
      </div>
      <div className="p-6">
        <Field label="Words and phrases to avoid" hint="The AI never uses these. Press Enter after each one.">
          <PhraseInput value={draft.avoid_words} onChange={(avoid_words) => set({ avoid_words })} />
        </Field>
      </div>
      <div className="p-6">
        <Field label="Example posts" hint="Paste up to three posts you are proud of. The AI matches their voice without copying them.">
          <div className="space-y-2">
            {examples.map((text, i) => (
              <textarea
                key={i}
                className="input resize-y"
                rows={3}
                maxLength={2000}
                placeholder={`Example post ${i + 1}`}
                value={text}
                onChange={(e) => {
                  const next = [...examples];
                  next[i] = e.target.value;
                  set({ example_posts: next });
                }}
              />
            ))}
          </div>
        </Field>
      </div>
      <div className="p-6">
        <button className="btn btn-primary" onClick={save} disabled={!dirty || saving}>
          {saving && <Loader2 size={15} className="animate-spin" />} {dirty ? "Save voice" : "Saved"}
        </button>
      </div>
    </div>
  );
}

function PhraseInput({ value, onChange }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const phrase = draft.trim().toLowerCase();
    if (phrase && !value.includes(phrase)) onChange([...value, phrase].slice(0, 30));
    setDraft("");
  };
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-white p-1.5">
      {value.map((w) => (
        <span key={w} className="inline-flex items-center gap-1 rounded-md bg-paper py-0.5 pr-1 pl-2 text-xs text-ink">
          {w}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== w))} className="text-subtle hover:text-ink" aria-label={`Remove ${w}`}>
            &times;
          </button>
        </span>
      ))}
      <input
        className="min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-subtle"
        placeholder={value.length ? "" : "e.g. synergy, hustle, game changer"}
        value={draft}
        maxLength={60}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

// ---- fonts -----------------------------------------------------------------------------

function FontsTab() {
  const toast = useToast();
  const fonts = useCustomFonts();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    try {
      const item = await fontFileToItem(file);
      if (fonts.some((f) => f.family === item.family)) item.family = `${item.family} ${fonts.length + 1}`.slice(0, 40);
      await saveItem("font", item);
      toast(`${item.family} added`);
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setBusy(false);
      input.current.value = "";
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="card p-6">
        <p className="text-sm font-medium text-ink">Upload a font</p>
        <p className="mt-0.5 text-xs text-subtle">WOFF2, WOFF, TTF, or OTF, up to 2 MB. Make sure your license allows use in social graphics.</p>
        <button className="btn btn-secondary mt-4" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />} Choose font file
        </button>
        <input ref={input} type="file" accept={FONT_ACCEPT} className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      {fonts.length > 0 && (
        <ul className="card divide-y divide-line">
          {fonts.map((f) => (
            <li key={f.id} className="flex items-center gap-4 p-4">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-2xl text-ink" style={{ fontFamily: customFontCss(f.family) }}>
                  Every post, on brand
                </span>
                <span className="text-xs text-subtle">{f.family}</span>
              </span>
              <button className="btn btn-ghost btn-icon" onClick={() => deleteItem("font", f.id).catch((err) => toast(err.message, { tone: "error" }))} aria-label={`Delete ${f.family}`}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const TABS = [
  { value: "look", label: "Look" },
  { value: "voice", label: "Voice" },
  { value: "fonts", label: "Fonts" },
];

export default function BrandPage() {
  const [tab, setTab] = useState("look");
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Brand kit</h1>
          <p className="mt-1 text-sm text-muted">Your look and your voice. New projects and every AI draft use them.</p>
        </div>
        <Link to="/onboarding" className="btn btn-ghost">
          <ClipboardList size={14} /> Retake questionnaire
        </Link>
      </div>
      <div className="mt-6 mb-6 w-72">
        <Segmented value={tab} onChange={setTab} options={TABS} />
      </div>
      {tab === "look" && <LookTab />}
      {tab === "voice" && <VoiceTab />}
      {tab === "fonts" && <FontsTab />}
    </div>
  );
}
