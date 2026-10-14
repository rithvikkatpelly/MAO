import { useMemo } from "react";
import { pageDocument, unitSize } from "../../lib/design";

// One AI-designed page, scaled to `width`. The iframe is sandboxed with no permissions:
// no scripts, no forms, no navigation, and a unique origin.
export default function DesignFrame({ catalog, format, style, unit, width, className = "", title = "Design page" }) {
  const { w, h } = unitSize(catalog, format, unit);
  const scale = width / w;
  const page = unit?.page;
  const doc = useMemo(() => (page ? pageDocument(catalog, format, style, page) : ""), [catalog, format, style, page]);
  return (
    <div className={`relative overflow-hidden bg-white ${className}`} style={{ width, height: Math.round(h * scale) }}>
      {doc && (
        <iframe
          title={title}
          sandbox=""
          srcDoc={doc}
          loading="lazy"
          tabIndex={-1}
          style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left", border: 0, pointerEvents: "none" }}
        />
      )}
    </div>
  );
}
