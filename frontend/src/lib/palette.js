// Pulls the main brand colors out of a logo.
// Pixels are grouped into coarse color buckets; the biggest buckets win, with a
// boost for saturated colors (a logo's white background should not be the "brand color").

function toHex(r, g, b) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function saturationAndLightness(r, g, b) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

function distance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

export function extractPalette(img, count = 6) {
  const size = 96;
  const canvas = document.createElement("canvas");
  const scale = size / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
  canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;
    buckets.set(key, bucket);
  }

  const candidates = [...buckets.values()]
    .map(({ r, g, b, n }) => {
      const rgb = [r / n, g / n, b / n];
      const { s, l } = saturationAndLightness(...rgb);
      const neutral = s < 0.15 || l > 0.94 || l < 0.06;
      return { rgb, neutral, score: n * (neutral ? 0.35 : 1 + s) };
    })
    .sort((a, b) => b.score - a.score);

  const picked = [];
  for (const c of candidates) {
    if (picked.every((p) => distance(p.rgb, c.rgb) > 48)) picked.push(c);
    if (picked.length === count) break;
  }
  // Brand colors first, neutrals (black, white, grays) after.
  picked.sort((a, b) => Number(a.neutral) - Number(b.neutral));
  return picked.map((c) => toHex(...c.rgb));
}

export function pickAccent(palette) {
  return palette[0] ?? "#ff5a3c";
}
