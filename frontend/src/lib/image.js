// Browser-side image handling: logos and profile photos are resized here and kept
// as data URLs, so they stay small, embed directly in slides, and export cleanly.

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];

export const IMAGE_ACCEPT = ACCEPTED.join(",");

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file could not be read as an image."));
    img.src = src;
  });
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.readAsDataURL(file);
  });
}

export async function fileToImage(file) {
  if (!ACCEPTED.includes(file.type)) throw new Error("Use a PNG, JPG, WebP, SVG, or GIF image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Images must be under 10 MB.");
  return loadImage(await readAsDataUrl(file));
}

// Logo: fit inside maxSize, keep transparency, trim fully transparent borders.
export function logoToDataUrl(img, maxSize = 512) {
  const w = img.naturalWidth || img.width || maxSize;
  const h = img.naturalHeight || img.height || maxSize;
  const scale = Math.min(1, maxSize / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const trimmed = trimTransparent(canvas);
  return trimmed.toDataURL("image/png");
}

function trimTransparent(canvas) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0 || (left === 0 && top === 0 && right === width - 1 && bottom === height - 1)) return canvas;
  const out = document.createElement("canvas");
  out.width = right - left + 1;
  out.height = bottom - top + 1;
  out.getContext("2d").drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// Profile photo: centered square crop.
export function avatarToDataUrl(img, size = 320) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const side = Math.min(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d").drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.88);
}

// Slide photos and screenshots: fit inside maxSize, WebP keeps both photos and text sharp and small.
export function photoToDataUrl(img, maxSize = 1600) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxSize / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", 0.9);
}
