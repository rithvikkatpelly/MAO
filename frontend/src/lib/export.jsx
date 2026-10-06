import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { getFontEmbedCSS, toJpeg, toPng, toSvg } from "html-to-image";
import { sizeOf } from "./formats";
import { CUSTOM_PREFIX } from "./fonts";
import { FONTS, SlideCanvas } from "./templates";
import { formatHashtags } from "./text";

// Renders slides off-screen at native size and rasterizes them, so exports
// match the editor exactly (including anything the user edited).

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "aurea"
  );
}

async function loadFonts(project) {
  const families = Object.values(FONTS).map((f) => f.css.split(",")[0]);
  if (project.design.font?.startsWith(CUSTOM_PREFIX)) families.push(`'${project.design.font.slice(CUSTOM_PREFIX.length)}'`);
  await Promise.all(
    families.flatMap((family) => ["400", "700"].map((weight) => document.fonts.load(`${weight} 40px ${family}`).catch(() => {}))),
  );
  await document.fonts.ready;
}

async function rasterize(project, brand, indices, { pixelRatio = 1, type = "png" } = {}) {
  const { w, h } = sizeOf(project);
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    flushSync(() =>
      root.render(
        indices.map((i) => (
          <div key={project.slides[i].id} data-slide style={{ width: w, height: h }}>
            <SlideCanvas project={project} slide={project.slides[i]} index={i} brand={brand} />
          </div>
        )),
      ),
    );
    await loadFonts(project);

    const nodes = [...host.querySelectorAll("[data-slide]")];
    const fontEmbedCSS = await getFontEmbedCSS(nodes[0]);
    const capture = { jpeg: toJpeg, png: toPng, svg: toSvg }[type];
    const images = [];
    for (const node of nodes) {
      images.push(await capture(node, { width: w, height: h, pixelRatio, fontEmbedCSS, quality: 0.94 }));
    }
    return images;
  } finally {
    root.unmount();
    host.remove();
  }
}

function download(href, filename) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (href.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(href), 1000);
}

const pad = (n) => String(n).padStart(2, "0");

function pages(project) {
  return project.slides.map((_, i) => i);
}

export async function exportPng(project, brand, index) {
  const [png] = await rasterize(project, brand, [index]);
  download(png, `${slugify(project.title)}-${pad(index + 1)}.png`);
}

export async function exportZip(project, brand) {
  const { default: JSZip } = await import("jszip");
  const images = await rasterize(project, brand, pages(project));
  const zip = new JSZip();
  images.forEach((png, i) => zip.file(`${slugify(project.title)}-${pad(i + 1)}.png`, png.split(",")[1], { base64: true }));
  const blob = await zip.generateAsync({ type: "blob" });
  download(URL.createObjectURL(blob), `${slugify(project.title)}.zip`);
}

async function buildPdf(project, images, format) {
  const { jsPDF } = await import("jspdf");
  const { w, h } = sizeOf(project);
  const orientation = w > h ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "px", format: [w, h], hotfixes: ["px_scaling"], compress: true });
  images.forEach((img, i) => {
    if (i > 0) pdf.addPage([w, h], orientation);
    pdf.addImage(img, format, 0, 0, w, h);
  });
  pdf.setProperties({ title: project.title, creator: "Aurea Studio" });
  return pdf;
}

export async function exportPdf(project, brand) {
  const images = await rasterize(project, brand, pages(project), { pixelRatio: 2, type: "jpeg" });
  (await buildPdf(project, images, "JPEG")).save(`${slugify(project.title)}.pdf`);
}

// The caption for one platform: its own caption if written, otherwise the default one.
export function captionFor(project, platform) {
  const own = project.captions?.[platform];
  const text = own?.caption?.trim() ? own.caption : project.caption ?? "";
  const tags = own?.caption?.trim() ? own.hashtags ?? [] : project.hashtags ?? [];
  return [text, formatHashtags(tags)].filter(Boolean).join("\n\n");
}

const BUNDLE_README = `Aurea export bundle

linkedin/   Upload document.pdf as a document post (it shows as a swipeable carousel).
            Paste caption.txt as the post text.
instagram/  Add the PNGs in order as one carousel post. Paste caption.txt.
x/          Attach up to 4 images to one post. post.txt is the text; thread.txt (if present) is a full thread.
threads/    Attach the images and paste post.txt.
`;

// One ZIP laid out per platform: sized images, a PDF for LinkedIn, and each platform's caption.
export async function exportBundle(project, brand) {
  const { default: JSZip } = await import("jszip");
  const images = await rasterize(project, brand, pages(project));
  const zip = new JSZip();
  const name = slugify(project.title);
  const addImages = (folder, list) =>
    list.forEach((png, i) => zip.file(`${folder}/${name}-${pad(i + 1)}.png`, png.split(",")[1], { base64: true }));

  const pdf = await buildPdf(project, images, "PNG");
  zip.file("linkedin/document.pdf", pdf.output("arraybuffer"));
  zip.file("linkedin/caption.txt", captionFor(project, "linkedin"));

  addImages("instagram", images.slice(0, 20));
  zip.file("instagram/caption.txt", captionFor(project, "instagram"));

  addImages("x", images.slice(0, 4));
  zip.file("x/post.txt", captionFor(project, "x"));
  const thread = project.outputs?.x_thread?.posts;
  if (thread?.length) zip.file("x/thread.txt", thread.map((p, i) => `${i + 1}/${thread.length}\n${p}`).join("\n\n"));

  addImages("threads", images.slice(0, 10));
  zip.file("threads/post.txt", captionFor(project, "threads"));

  zip.file("README.txt", BUNDLE_README);
  const blob = await zip.generateAsync({ type: "blob" });
  download(URL.createObjectURL(blob), `${name}-bundle.zip`);
}

// The first `count` slides as JPEG data URLs at native size, for publishing to a platform.
export function renderJpegs(project, brand, count = project.slides.length) {
  return rasterize(project, brand, pages(project).slice(0, count), { type: "jpeg" });
}

// One slide or infographic page as an SVG file with fonts embedded.
export async function exportSvg(project, brand, index = 0) {
  const [svg] = await rasterize(project, brand, [index], { type: "svg" });
  download(svg, `${slugify(project.title)}-${pad(index + 1)}.svg`);
}

// A PowerPoint file: one full-bleed image per slide, with the speaker notes attached.
export async function exportPptx(project, brand) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const images = await rasterize(project, brand, pages(project), { pixelRatio: 1 });
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = project.title;
  images.forEach((png, i) => {
    const slide = pptx.addSlide();
    slide.addImage({ data: png, x: 0, y: 0, w: "100%", h: "100%" });
    if (project.slides[i]?.notes) slide.addNotes(project.slides[i].notes);
  });
  await pptx.writeFile({ fileName: `${slugify(project.title)}.pptx` });
}

export async function copyPng(project, brand, index) {
  const [png] = await rasterize(project, brand, [index]);
  const blob = await (await fetch(png)).blob();
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}
