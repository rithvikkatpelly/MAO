import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, CircleAlert, Loader2, RotateCcw, Sparkles, Trash2, TriangleAlert, WandSparkles } from "lucide-react";
import { ai } from "../../lib/api";
import { applyOperations, maxSlidesFor, projectForAssistant, suggestionsFor } from "../../lib/assistant";
import { TEMPLATES } from "../../lib/templates";

const HISTORY_SENT = 8; // earlier turns sent with each request; the project itself is always sent

let nextId = 1;

// Chat with the AI to edit the project. Every answer applies as one undoable step.
// `chat` and `setChat` live in the editor so the conversation survives switching tabs.
export default function AssistantPanel({ project, activeIndex, onReplace, chat, setChat }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const projectRef = useRef(project);
  const listRef = useRef(null);

  // The latest project, for applying an answer that arrives after the creator kept editing.
  useLayoutEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.length, busy]);

  async function send(text) {
    const message = text.trim();
    if (!message || busy) return;
    const history = chat
      .filter((m) => m.role === "user" || (m.role === "assistant" && m.text))
      .slice(-HISTORY_SENT)
      .map((m) => ({ role: m.role, content: m.text.slice(0, 2000) }));
    setChat((c) => [...c, { id: nextId++, role: "user", text: message }]);
    setDraft("");
    setBusy(true);
    try {
      const sent = projectRef.current;
      const res = await ai.edit({
        message,
        history,
        project: projectForAssistant(sent),
        active_slide: activeIndex + 1,
        templates: Object.keys(TEMPLATES),
        max_slides: maxSlidesFor(sent.kind),
      });
      // Apply to the project as it is now: the creator may have kept editing while waiting.
      const before = projectRef.current;
      const { project: after, changes } = res.operations.length ? applyOperations(before, res.operations) : { project: before, changes: [] };
      if (changes.length) onReplace(after);
      setChat((c) => [
        ...c,
        { id: nextId++, role: "assistant", text: res.reply, changes, warnings: res.warnings ?? [], before: changes.length ? before : null, after: changes.length ? after : null },
      ]);
    } catch (err) {
      setChat((c) => [...c, { id: nextId++, role: "error", text: err.message || "The assistant could not finish. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  function revert(message) {
    onReplace(message.before);
    setChat((c) => c.map((m) => (m.id === message.id ? { ...m, reverted: true } : m)));
  }

  const latestApplied = [...chat].reverse().find((m) => m.after && !m.reverted);

  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="flex items-start gap-2 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <WandSparkles size={15} className="text-accent" /> Edit with AI
          </p>
          <p className="mt-0.5 text-xs text-muted">Say what to change. Each answer applies as one step you can undo.</p>
        </div>
        {chat.length > 0 && (
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => setChat([])} disabled={busy} title="Clear chat" aria-label="Clear chat">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div ref={listRef} className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
        {chat.length === 0 && (
          <div>
            <p className="text-xs text-subtle">Try one of these, or write your own. You are on slide {activeIndex + 1}, so "this slide" means that one.</p>
            <div className="mt-3 flex flex-col gap-1.5">
              {suggestionsFor(project.kind).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-left text-sm text-ink transition hover:border-ink/25 hover:bg-paper"
                >
                  <Sparkles size={13} className="shrink-0 text-accent" /> {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {chat.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3 py-2 text-sm whitespace-pre-wrap text-white">{m.text}</p>
            </div>
          ) : m.role === "error" ? (
            <p key={m.id} className="flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <CircleAlert size={15} className="mt-0.5 shrink-0" /> {m.text}
            </p>
          ) : (
            <div key={m.id} className="max-w-[92%] rounded-2xl rounded-bl-md bg-paper px-3 py-2.5 text-sm text-ink">
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.changes?.length > 0 && (
                <ul className={`mt-2 space-y-0.5 text-xs ${m.reverted ? "text-subtle line-through" : "text-muted"}`}>
                  {m.changes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              )}
              {m.warnings?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {m.warnings.map((w) => (
                    <li key={w} className="flex gap-1.5 text-xs text-amber-700">
                      <TriangleAlert size={12} className="mt-0.5 shrink-0" /> {w}
                    </li>
                  ))}
                </ul>
              )}
              {m.reverted && <p className="mt-2 text-xs text-subtle">Reverted.</p>}
              {m === latestApplied && project === m.after && (
                <button type="button" className="btn btn-ghost mt-1.5 -ml-2 h-7 px-2 text-xs" onClick={() => revert(m)}>
                  <RotateCcw size={12} /> Revert these changes
                </button>
              )}
            </div>
          ),
        )}

        {busy && (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Loader2 size={14} className="animate-spin text-accent" /> Editing. This takes 10 to 40 seconds on the local model.
          </p>
        )}
      </div>

      <form
        className="border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <div className="flex items-end gap-2 rounded-xl border border-line bg-white p-1.5 focus-within:border-ink/30">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={2}
            maxLength={1000}
            placeholder={`For example: make slide ${activeIndex + 1} shorter`}
            aria-label="Message to the AI assistant"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-subtle"
            disabled={busy}
          />
          <button type="submit" className="btn btn-accent btn-icon h-9 w-9 shrink-0" disabled={busy || !draft.trim()} aria-label="Send">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-subtle">Enter to send, Shift Enter for a new line.</p>
      </form>
    </div>
  );
}
