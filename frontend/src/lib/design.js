// The AI design studio's client side: catalog cache, preview documents, and projects.
// Pages are HTML written by the AI and sanitized on the server. Previews render them in a
// sandboxed iframe (no scripts, unique origin), and exports are rendered by the server again.
import { useEffect, useState } from "react";
import { design } from "./api";

let catalogPromise = null;

export function loadCatalog() {
  catalogPromise ??= design.catalog().catch((err) => {
    catalogPromise = null;
    throw err;
  });
  return catalogPromise;
}

export function useCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let live = true;
    loadCatalog()
      .then((c) => live && setCatalog(c))
      .catch((err) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, []);
  return { catalog, error };
}

const escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// A full document for one framed page, for a sandboxed iframe's srcdoc.
export function pageDocument(catalog, format, style, pageHtml) {
  const s = catalog.styles[style];
  const css = s.css[format];
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src data:">
<link rel="stylesheet" href="${escapeAttr(s.fonts_url)}"><link rel="stylesheet" href="${escapeAttr(catalog.font_awesome)}">
<style>html,body{margin:0;overflow:hidden;background:transparent}${css}</style></head><body>${pageHtml}</body></html>`;
}

export const DESIGN_FORMAT_ORDER = ["carousel", "slides", "infographic", "flyer", "brochure"];

// The page size in CSS pixels; infographic sections have no fixed height.
export function unitSize(catalog, format, unit) {
  const f = catalog.formats[format];
  return { w: f.width, h: f.height ?? unit?.check?.height ?? 380 };
}

export function designProject({ title, format, style, query, topic, designIdeas, meta, units, sources }) {
  return {
    title: title || topic?.title || "Untitled design",
    kind: "design",
    format,
    style,
    query,
    topic,
    designIdeas,
    meta,
    sources: sources ?? [],
    slides: units.map((u) => ({ id: crypto.randomUUID().slice(0, 12), role: u.role, content: u.content, html: u.html, page: u.page, check: u.check, warnings: u.warnings ?? [] })),
  };
}

export async function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
