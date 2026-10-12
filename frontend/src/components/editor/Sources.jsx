import { ExternalLink, ListPlus } from "lucide-react";
import { safeUrl } from "../../lib/url";

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// The research behind a generated post, with a one-click sources slide.
export default function Sources({ project, onAddSlide }) {
  const sources = project.sources ?? [];
  if (!sources.length) return <p className="text-xs text-subtle">Posts created with AI research list their sources here.</p>;
  const hasSlide = project.slides.some((s) => s.layout === "sources");

  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {sources.map((s, i) => {
          const href = safeUrl(s.url);
          return (
            <li key={s.url || i} className="flex gap-2.5 text-xs">
              <span className="w-4 shrink-0 font-semibold text-accent">{i + 1}</span>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="group min-w-0 flex-1">
                  <span className="line-clamp-2 text-ink group-hover:underline">{s.title}</span>
                  <span className="flex items-center gap-1 text-subtle">
                    {domainOf(href)} <ExternalLink size={10} />
                  </span>
                </a>
              ) : (
                <span className="line-clamp-2 min-w-0 flex-1 text-ink">{s.title}</span>
              )}
            </li>
          );
        })}
      </ol>
      {!hasSlide && (
        <button type="button" className="btn btn-secondary w-full" onClick={onAddSlide}>
          <ListPlus size={14} /> Add a sources slide
        </button>
      )}
    </div>
  );
}
