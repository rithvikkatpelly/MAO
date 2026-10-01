import { useState } from "react";
import { ChevronDown, Copy, ExternalLink, ImagePlus, Loader2, Minus, Plus, RefreshCw, Sparkles } from "lucide-react";
import { ai, projectForAI } from "../../lib/api";
import { TEXT_FORMATS } from "../../lib/formats";
import { composerFor, openComposer, outputToText } from "../../lib/outputs";
import { AutoTextarea, CharCount, TagInput } from "../controls";
import { useToast } from "../Toast";

// Editable view of one generated format. `onChange(data)` replaces the output.
export function OutputEditor({ format, data, onChange, onMakeThumbnail }) {
  const set = (patch) => onChange({ ...data, ...patch });
  const listField = (key, value, i) => set({ [key]: data[key].map((v, j) => (j === i ? value : v)) });

  if (format === "x_thread")
    return (
      <div className="space-y-2">
        {data.posts.map((post, i) => (
          <div key={i}>
            <div className="mb-1 flex items-center justify-between text-[11px] text-subtle">
              <span>
                {i + 1} of {data.posts.length}
              </span>
              <span className="flex items-center gap-2">
                <CharCount value={post} limit={280} />
                {data.posts.length > 1 && (
                  <button type="button" onClick={() => set({ posts: data.posts.filter((_, j) => j !== i) })} aria-label="Remove post" className="hover:text-ink">
                    <Minus size={12} />
                  </button>
                )}
              </span>
            </div>
            <AutoTextarea minRows={2} value={post} onChange={(e) => listField("posts", e.target.value, i)} />
          </div>
        ))}
        {data.posts.length < 15 && (
          <button type="button" className="btn btn-ghost h-8 px-2 text-xs" onClick={() => set({ posts: [...data.posts, ""] })}>
            <Plus size={13} /> Add post
          </button>
        )}
      </div>
    );

  if (format === "linkedin_post")
    return (
      <div>
        <AutoTextarea minRows={8} value={data.text} onChange={(e) => set({ text: e.target.value })} />
        <div className="mt-1 flex justify-end">
          <CharCount value={data.text} limit={3000} />
        </div>
      </div>
    );

  if (format === "instagram_caption")
    return (
      <div className="space-y-2">
        <AutoTextarea minRows={6} value={data.caption} onChange={(e) => set({ caption: e.target.value })} />
        <TagInput value={data.hashtags ?? []} onChange={(hashtags) => set({ hashtags })} />
      </div>
    );

  if (format === "newsletter")
    return (
      <div className="space-y-2">
        <label className="field-label">Subject</label>
        <input className="input" value={data.subject} onChange={(e) => set({ subject: e.target.value })} />
        <label className="field-label">Preview text</label>
        <input className="input" value={data.preview} onChange={(e) => set({ preview: e.target.value })} />
        <label className="field-label">Blurb</label>
        <AutoTextarea minRows={6} value={data.blurb} onChange={(e) => set({ blurb: e.target.value })} />
      </div>
    );

  if (format === "video_script")
    return (
      <div className="space-y-3">
        <input className="input font-medium" value={data.title} onChange={(e) => set({ title: e.target.value })} aria-label="Title" />
        <div className="rounded-lg bg-accent/5 p-3">
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-accent uppercase">Hook, first 3 seconds</p>
          <AutoTextarea minRows={2} value={data.hook} onChange={(e) => set({ hook: e.target.value })} aria-label="Hook voiceover" />
          <input className="input mt-1.5" value={data.hook_text} placeholder="On-screen text" onChange={(e) => set({ hook_text: e.target.value })} aria-label="Hook on-screen text" />
        </div>
        {data.beats.map((beat, i) => (
          <div key={i} className="rounded-lg border border-line p-3">
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Beat {i + 1}</p>
            <AutoTextarea minRows={2} value={beat.voiceover} onChange={(e) => listField("beats", { ...beat, voiceover: e.target.value }, i)} aria-label={`Beat ${i + 1} voiceover`} />
            <input className="input mt-1.5" value={beat.on_screen_text} placeholder="On-screen text" onChange={(e) => listField("beats", { ...beat, on_screen_text: e.target.value }, i)} aria-label={`Beat ${i + 1} on-screen text`} />
          </div>
        ))}
        <div>
          <p className="field-label">Call to action</p>
          <input className="input" value={data.cta} onChange={(e) => set({ cta: e.target.value })} />
        </div>
      </div>
    );

  if (format === "youtube")
    return (
      <div className="space-y-3">
        <div>
          <p className="field-label">Title options</p>
          <div className="space-y-1.5">
            {data.titles.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="input" value={t} onChange={(e) => listField("titles", e.target.value, i)} />
                <CharCount value={t} limit={70} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="field-label">Thumbnail text</p>
          <div className="space-y-1.5">
            {data.thumbnail_texts.map((t, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input className="input" value={t} onChange={(e) => listField("thumbnail_texts", e.target.value, i)} />
                {onMakeThumbnail && (
                  <button type="button" className="btn btn-secondary h-9 shrink-0 px-2.5 text-xs" onClick={() => onMakeThumbnail(t)} title="Create a thumbnail project with this text">
                    <ImagePlus size={13} /> Design
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="field-label">Description</p>
          <AutoTextarea minRows={5} value={data.description} onChange={(e) => set({ description: e.target.value })} />
        </div>
      </div>
    );
  return null;
}

function FormatCard({ format, data, busy, onGenerate, onChange, onMakeThumbnail }) {
  const toast = useToast();
  const [open, setOpen] = useState(!!data);
  const meta = TEXT_FORMATS[format];
  const composer = composerFor(format, data);

  async function copy() {
    try {
      await navigator.clipboard.writeText(outputToText(format, data));
      toast(`${meta.label} copied`);
    } catch {
      toast("Could not access the clipboard", { tone: "error" });
    }
  }

  return (
    <div className="rounded-xl border border-line">
      <div className="flex items-center gap-3 p-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper text-muted">
          <meta.icon size={15} />
        </span>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => data && setOpen(!open)} disabled={!data}>
          <span className="block text-sm font-medium text-ink">{meta.label}</span>
          <span className="block truncate text-xs text-subtle">{data ? "Ready. Click to edit." : meta.description}</span>
        </button>
        {data ? (
          <>
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => onGenerate(format)} disabled={busy} title="Write it again" aria-label="Regenerate">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </button>
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setOpen(!open)} aria-label="Toggle">
              <ChevronDown size={15} className={`transition ${open ? "rotate-180" : ""}`} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-secondary h-8 px-2.5 text-xs"
            disabled={busy}
            onClick={async () => {
              await onGenerate(format);
              setOpen(true);
            }}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Create
          </button>
        )}
      </div>
      {data && open && (
        <div className="animate-fade-in border-t border-line p-3">
          <OutputEditor format={format} data={data} onChange={onChange} onMakeThumbnail={onMakeThumbnail} />
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-secondary flex-1" onClick={copy}>
              <Copy size={14} /> Copy
            </button>
            {composer && (
              <button type="button" className="btn btn-secondary" onClick={() => openComposer(composer.platform, composer.text)}>
                <ExternalLink size={14} /> Open in {composer.platform === "x" ? "X" : "LinkedIn"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Turn this project into other formats. Outputs are saved on the project.
export default function RepurposePanel({ project, onChange, onMakeThumbnail, formats = Object.keys(TEXT_FORMATS) }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const outputs = project.outputs ?? {};

  async function generate(format) {
    setBusy(format);
    try {
      const { data } = await ai.repurpose(format, projectForAI(project));
      onChange({ outputs: { ...project.outputs, [format]: data } });
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {formats.map((format) => (
        <FormatCard
          key={format}
          format={format}
          data={outputs[format]}
          busy={busy === format}
          onGenerate={generate}
          onMakeThumbnail={onMakeThumbnail}
          onChange={(data) => onChange({ outputs: { ...project.outputs, [format]: data } }, `output-${format}`)}
        />
      ))}
    </div>
  );
}
