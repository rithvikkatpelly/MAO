import { useEffect, useState } from "react";
import { Bookmark, History, Loader2, RotateCcw } from "lucide-react";
import { versions } from "../../lib/api";
import { outputToText } from "../../lib/outputs";
import { relativeTime } from "../../lib/time";
import Popover from "../Popover";
import { SlideFrame } from "../SlideFrame";
import { useToast } from "../Toast";

const REASONS = {
  auto: "Autosave",
  export: "Exported",
  manual: "Saved",
  restore: "Before restore",
};

function Preview({ data, brand }) {
  if (data.kind === "text") {
    const text = outputToText(data.textFormat, data.outputs?.[data.textFormat]);
    return <p className="line-clamp-6 rounded-lg bg-paper p-3 text-xs whitespace-pre-line text-muted">{text || "Empty"}</p>;
  }
  if (!data.slides?.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {data.slides.slice(0, 4).map((slide, i) => (
        <SlideFrame key={slide.id ?? i} project={data} slide={slide} index={i} brand={brand} width={96} className="rounded-sm ring-1 ring-line" />
      ))}
    </div>
  );
}

function HistoryList({ project, brand, onRestore, close }) {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null); // { id, data }
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(null);

  async function refresh() {
    try {
      setList(await versions.list(project.id));
    } catch (err) {
      toast(err.message, { tone: "error" });
      setList([]);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function saveNamed(e) {
    e.preventDefault();
    setBusy("save");
    try {
      await versions.create(project, "manual", label.trim());
      setLabel("");
      await refresh();
      toast("Version saved");
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function preview(v) {
    if (open?.id === v.id) return setOpen(null);
    setBusy(v.id);
    try {
      setOpen({ id: v.id, data: (await versions.get(project.id, v.id)).data });
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    try {
      await versions.create(project, "restore", "Before restoring");
      onRestore(open.data);
      toast("Version restored. Undo is available.");
      close();
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold text-ink">Version history</p>
      <p className="mt-0.5 text-xs text-subtle">Saved automatically every 10 minutes while you edit, and whenever you export.</p>

      <form onSubmit={saveNamed} className="mt-3 flex gap-1.5">
        <input className="input" placeholder="Name this version (optional)" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn btn-secondary shrink-0" disabled={busy === "save"}>
          {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Bookmark size={14} />} Save
        </button>
      </form>

      <div className="scrollbar-thin mt-3 max-h-[55vh] space-y-1.5 overflow-y-auto">
        {list === null ? (
          <div className="flex justify-center py-6 text-subtle">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="py-4 text-center text-xs text-subtle">No versions yet. Keep editing and one is saved automatically.</p>
        ) : (
          list.map((v) => (
            <div key={v.id} className={`rounded-lg border ${open?.id === v.id ? "border-ink/25 bg-paper/60" : "border-line"}`}>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => preview(v)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{v.label || REASONS[v.reason] || v.reason}</span>
                  <span className="block text-xs text-subtle" title={new Date(v.createdAt).toLocaleString()}>
                    {relativeTime(v.createdAt)}
                    {v.label && ` · ${REASONS[v.reason]}`}
                    {v.slides > 0 && ` · ${v.slides} slide${v.slides === 1 ? "" : "s"}`}
                  </span>
                </span>
                {busy === v.id && <Loader2 size={14} className="animate-spin text-subtle" />}
              </button>
              {open?.id === v.id && (
                <div className="animate-fade-in space-y-2 border-t border-line p-3">
                  <Preview data={open.data} brand={brand} />
                  <button type="button" className="btn btn-primary w-full" onClick={restore} disabled={busy === "restore"}>
                    {busy === "restore" ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Restore this version
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Top bar button that opens version history for the current project.
export default function HistoryButton({ project, brand, onRestore, onOpen }) {
  return (
    <Popover
      width="w-96"
      trigger={({ toggle, open }) => (
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (!open) onOpen?.();
            toggle();
          }}
          title="Version history"
        >
          <History size={16} />
          <span className="hidden xl:inline">History</span>
        </button>
      )}
    >
      {({ close }) => <HistoryList project={project} brand={brand} onRestore={onRestore} close={close} />}
    </Popover>
  );
}
