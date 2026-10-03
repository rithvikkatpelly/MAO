import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CircleAlert, CircleCheck, ExternalLink, Loader2, Send, TriangleAlert, X } from "lucide-react";
import InstagramGlyph from "../InstagramGlyph";
import { SlideFrame } from "../SlideFrame";
import { CharCount } from "../controls";
import { useToast } from "../Toast";
import { instagram } from "../../lib/api";
import { captionFor, renderJpegs } from "../../lib/export";
import { IG_LIMITS, countHashtags, instagramIssues, startInstagramConnect } from "../../lib/instagram";
import { loadItems } from "../../lib/items";

function Thumbs({ project, brand, count }) {
  return (
    <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
      {project.slides.slice(0, count).map((slide, i) => (
        <SlideFrame key={slide.id} project={project} slide={slide} index={i} brand={brand} width={72} className="rounded-md border border-line" />
      ))}
    </div>
  );
}

function PublishDialog({ project, brand, onClose, onPublished }) {
  const toast = useToast();
  const location = useLocation();
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [caption, setCaption] = useState(() => captionFor(project, "instagram"));
  const [step, setStep] = useState(null); // progress text while posting
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const count = Math.min(project.slides.length, IG_LIMITS.images);
  const issues = useMemo(() => instagramIssues(project, caption), [project, caption]);
  const blocked = issues.some((i) => i.level === "error");
  const account = status?.account;
  const posting = step !== null;

  useEffect(() => {
    instagram
      .status()
      .then(setStatus)
      .catch((err) => setLoadError(err.message));
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !posting && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [posting, onClose]);

  async function post() {
    setError("");
    try {
      setStep("Rendering slides");
      const images = await renderJpegs(project, brand, count);
      const media = [];
      for (const [i, data] of images.entries()) {
        setStep(images.length > 1 ? `Uploading image ${i + 1} of ${images.length}` : "Uploading image");
        media.push((await instagram.uploadImage(data)).token);
      }
      setStep("Publishing to Instagram");
      const res = await instagram.publish({ media, caption, project_id: project.id, title: project.title });
      setResult(res);
      onPublished(res);
      loadItems("metric", { force: true });
      toast(`Posted to @${res.username}`);
    } catch (err) {
      setError(err.message || "Posting failed. Please try again.");
      if (err.status === 401) setStatus((s) => s && { ...s, account: null });
    } finally {
      setStep(null);
    }
  }

  async function connect() {
    try {
      await startInstagramConnect(location.pathname);
    } catch (err) {
      setError(err.message);
    }
  }

  let body;
  if (result) {
    body = (
      <div className="py-6 text-center">
        <CircleCheck size={36} className="mx-auto text-emerald-500" />
        <p className="mt-3 text-base font-semibold text-ink">Posted to @{result.username}</p>
        <p className="mt-1 text-sm text-muted">It is live on Instagram and logged on Insights, where you can add its results later.</p>
        <div className="mt-6 flex justify-center gap-2">
          {result.permalink && (
            <a href={result.permalink} target="_blank" rel="noreferrer" className="btn btn-primary">
              View on Instagram <ExternalLink size={14} />
            </a>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    );
  } else if (!status && !loadError) {
    body = (
      <p className="flex items-center gap-2 py-8 text-sm text-muted">
        <Loader2 size={15} className="animate-spin" /> Checking your Instagram connection
      </p>
    );
  } else if (loadError || !status.configured) {
    body = (
      <div className="rounded-xl bg-paper p-4 text-sm text-muted">
        {loadError || "Instagram publishing is not set up on this server yet."}{" "}
        <Link to="/app/connections" className="font-medium text-ink underline">
          Open Connections
        </Link>
      </div>
    );
  } else if (!account) {
    body = (
      <div className="py-4 text-center">
        <p className="text-sm text-muted">Connect a Business or Creator account to post without leaving Aurea.</p>
        <button className="btn btn-primary mt-4" onClick={connect}>
          <InstagramGlyph size={15} /> Connect Instagram
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  } else {
    body = (
      <>
        <div className="flex items-center gap-2.5">
          {account.profile_picture_url ? (
            <img src={account.profile_picture_url} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
              {account.username.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-sm font-medium text-ink">@{account.username}</span>
          <Link to="/app/connections" className="ml-auto text-xs text-muted hover:text-ink">
            Change
          </Link>
        </div>

        <div className="mt-4">
          <p className="field-label">{count > 1 ? `Carousel, ${count} images` : "Single image"}</p>
          <Thumbs project={project} brand={brand} count={count} />
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="ig-caption" className="text-xs font-medium text-muted">
              Caption
            </label>
            <span className="flex gap-3">
              <span className="text-[11px] text-subtle tabular-nums">
                {countHashtags(caption)} / {IG_LIMITS.hashtags} hashtags
              </span>
              <CharCount value={caption} limit={IG_LIMITS.caption} />
            </span>
          </div>
          <textarea id="ig-caption" className="input min-h-36 resize-y" value={caption} onChange={(e) => setCaption(e.target.value)} disabled={posting} />
        </div>

        {issues.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {issues.map((issue) => (
              <li key={issue.text} className={`flex gap-2 text-xs ${issue.level === "error" ? "text-red-700" : "text-amber-700"}`}>
                {issue.level === "error" ? <CircleAlert size={14} className="mt-px shrink-0" /> : <TriangleAlert size={14} className="mt-px shrink-0" />}
                {issue.text}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mt-3 flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <CircleAlert size={15} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          {posting && <span className="mr-auto text-xs text-muted">{step}. Keep this tab open.</span>}
          <button className="btn btn-secondary" onClick={onClose} disabled={posting}>
            Cancel
          </button>
          <button className="btn btn-accent" onClick={post} disabled={posting || blocked}>
            {posting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {posting ? "Posting" : "Post now"}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-[90] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]" onMouseDown={() => !posting && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ig-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <InstagramGlyph size={18} className="text-ink" />
          <h2 id="ig-title" className="flex-1 text-base font-semibold text-ink">
            Post to Instagram
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} disabled={posting} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}

// Top bar button that opens the Instagram publish dialog.
export default function InstagramPublishButton({ project, brand, onPublished, onOpen }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="btn btn-secondary"
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
        title="Post to Instagram"
      >
        <InstagramGlyph size={15} />
        <span className="hidden xl:inline">Post</span>
      </button>
      {open && <PublishDialog project={project} brand={brand} onClose={() => setOpen(false)} onPublished={onPublished} />}
    </>
  );
}
