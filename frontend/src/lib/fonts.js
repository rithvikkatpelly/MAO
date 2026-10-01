import { useEffect } from "react";
import { useItems } from "./items";

// Uploaded fonts are declared as real @font-face rules in a <style> tag (not
// FontFace objects), so the exporter finds and embeds them like built-in fonts.

export const CUSTOM_PREFIX = "custom:";
export const FONT_ACCEPT = ".woff2,.woff,.ttf,.otf";

export function customFontCss(family) {
  return `'${family}', 'Inter Variable', sans-serif`;
}

export function useCustomFonts() {
  return useItems("font").items;
}

// Mount once inside the signed-in app.
export function CustomFontFaces() {
  const fonts = useCustomFonts();
  useEffect(() => {
    let tag = document.getElementById("aurea-custom-fonts");
    if (!tag) {
      tag = document.createElement("style");
      tag.id = "aurea-custom-fonts";
      document.head.appendChild(tag);
    }
    tag.textContent = fonts
      .map((f) => `@font-face { font-family: '${f.family}'; src: url(${f.data}); font-display: block; }`)
      .join("\n");
  }, [fonts]);
  return null;
}

const MIME = { woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf" };

export async function fontFileToItem(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (!MIME[ext]) throw new Error("Use a WOFF2, WOFF, TTF, or OTF font file.");
  if (file.size > 2 * 1024 * 1024) throw new Error("Font files must be under 2 MB. WOFF2 files are the smallest.");
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const family = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9 _-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40) || "Custom font";
  return { family, data: `data:${MIME[ext]};base64,${btoa(binary)}` };
}
