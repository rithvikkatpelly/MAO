import { useState } from "react";
import { Copy, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { ai, projectForAI } from "../../lib/api";
import { captionFor } from "../../lib/export";
import { COMPOSERS, openComposer } from "../../lib/outputs";
import { cleanText, formatHashtags, hasStyleIssues } from "../../lib/text";
import { AutoTextarea, CharCount, Segmented, TagInput } from "../controls";
import { useToast } from "../Toast";

const PLATFORMS = {
  default: { label: "Default", limit: null, rule: "Used for any platform without its own caption." },
  linkedin: { label: "LinkedIn", limit: 3000, rule: "Hook in the first line, short paragraphs, 3 to 5 hashtags." },
  instagram: { label: "Instagram", limit: 2200, rule: "Hook first, value, a call to save or share, 5 to 10 hashtags." },
  x: { label: "X", limit: 280, rule: "Under 280 characters including hashtags; 0 to 2 hashtags." },
  threads: { label: "Threads", limit: 500, rule: "Conversational, ends with a question, 0 or 1 hashtag." },
};

// Default caption plus a tailored caption per platform, since length and hashtag rules differ.
export default function CaptionsPanel({ project, onChange }) {
  const toast = useToast();
  const [platform, setPlatform] = useState("default");
  const [busy, setBusy] = useState(false);
  const meta = PLATFORMS[platform];
  const own = project.captions?.[platform] ?? { caption: "", hashtags: [] };
  const caption = platform === "default" ? project.caption : own.caption;
  const hashtags = platform === "default" ? project.hashtags : own.hashtags;
  const full = platform === "default" ? [project.caption, formatHashtags(project.hashtags)].filter(Boolean).join("\n\n") : captionFor(project, platform);

  function set(patch) {
    if (platform === "default") onChange(patch, `caption-${Object.keys(patch)[0]}`);
    else onChange({ captions: { ...project.captions, [platform]: { ...own, ...patch } } }, `caption-${platform}`);
  }

  async function generateAll() {
    setBusy(true);
    try {
      const result = await ai.captions(["linkedin", "instagram", "x", "threads"], projectForAI(project));
      onChange({ captions: { ...project.captions, ...result } });
      if (platform === "default") setPlatform("linkedin");
      toast("Captions written for 4 platforms");
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(full);
      toast("Caption copied");
    } catch {
      toast("Could not access the clipboard", { tone: "error" });
    }
  }

  return (
    <div className="space-y-3">
      <Segmented value={platform} onChange={setPlatform} size="sm" options={Object.entries(PLATFORMS).map(([value, p]) => ({ value, label: p.label }))} />
      <p className="text-xs text-subtle">{meta.rule}</p>
      <AutoTextarea minRows={5} value={caption} placeholder={platform === "default" ? "Write the text that goes with your post" : `Leave empty to use the default caption on ${meta.label}`} onChange={(e) => set({ caption: e.target.value })} />
      <div className="flex justify-end">
        <CharCount value={full} limit={meta.limit} />
      </div>
      <TagInput value={hashtags} onChange={(tags) => set({ hashtags: tags })} />
      {hasStyleIssues(caption) && (
        <button type="button" className="text-xs font-medium text-amber-700 underline-offset-2 hover:underline" onClick={() => set({ caption: cleanText(caption) })}>
          Remove em dashes and emojis
        </button>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" className="btn btn-secondary flex-1" onClick={generateAll} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {busy ? "Writing captions" : "Write for every platform"}
        </button>
        <button type="button" className="btn btn-secondary btn-icon h-9 w-9" onClick={copy} disabled={!full} title="Copy caption" aria-label="Copy caption">
          <Copy size={14} />
        </button>
        {COMPOSERS[platform] && (
          <button type="button" className="btn btn-secondary" onClick={() => openComposer(platform, full)} disabled={!full} title={`Open ${meta.label} with this caption filled in`}>
            <ExternalLink size={14} /> Post
          </button>
        )}
      </div>
    </div>
  );
}
