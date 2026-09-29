import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { getFontEmbedCSS, toJpeg, toPng } from "html-to-image";
import { sizeOf } from "./formats";
import { FONTS, SlideCanvas } from "./templates";

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

async function loadFonts() {
  const families = Object.values(FONTS).map((f) => f.css.split(",")[0]);
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
    await loadFonts();

    const nodes = [...host.querySelectorAll("[data-slide]")];
    const fontEmbedCSS = await getFontEmbedCSS(nodes[0]);
    const capture = type === "jpeg" ? toJpeg : toPng;
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

export async function exportPng(project, brand, index) {
  const [png] = await rasterize(project, brand, [index]);
  download(png, `${slugify(project.title)}-${pad(index + 1)}.png`);
}

export async function exportZip(project, brand) {
  const { default: JSZip } = await import("jszip");
  const images = await rasterize(project, brand, project.slides.map((_, i) => i));
  const zip = new JSZip();
  images.forEach((png, i) => zip.file(`${slugify(project.title)}-${pad(i + 1)}.png`, png.split(",")[1], { base64: true }));
  const blob = await zip.generateAsync({ type: "blob" });
  download(URL.createObjectURL(blob), `${slugify(project.title)}.zip`);
}

export async function exportPdf(project, brand) {
  const { jsPDF } = await import("jspdf");
  const { w, h } = sizeOf(project);
  const orientation = w > h ? "landscape" : "portrait";
  const images = await rasterize(project, brand, project.slides.map((_, i) => i), { pixelRatio: 2, type: "jpeg" });
  const pdf = new jsPDF({ orientation, unit: "px", format: [w, h], hotfixes: ["px_scaling"], compress: true });
  images.forEach((img, i) => {
    if (i > 0) pdf.addPage([w, h], orientation);
    pdf.addImage(img, "JPEG", 0, 0, w, h);
  });
  pdf.setProperties({ title: project.title, creator: "Aurea Studio" });
  pdf.save(`${slugify(project.title)}.pdf`);
}

export async function copyPng(project, brand, index) {
  const [png] = await rasterize(project, brand, [index]);
  const blob = await (await fetch(png)).blob();
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}
