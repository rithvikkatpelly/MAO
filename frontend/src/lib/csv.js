// Minimal RFC 4180 CSV parsing (quoted fields, escaped quotes, newlines in quotes).
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

// Column names seen in LinkedIn, X, Instagram, and spreadsheet exports.
const SYNONYMS = {
  posted_at: ["date", "posted", "postedat", "published", "publishdate", "created", "createddate", "time", "postdate"],
  platform: ["platform", "network", "channel", "source"],
  title: ["title", "post", "text", "content", "posttext", "caption", "description", "posttitle"],
  url: ["url", "link", "permalink", "posturl", "postlink"],
  impressions: ["impressions", "views", "reach", "impr", "videoviews", "plays"],
  likes: ["likes", "reactions", "likecount", "favorites"],
  comments: ["comments", "replies", "commentcount"],
  shares: ["shares", "reposts", "retweets", "sharecount"],
  saves: ["saves", "bookmarks", "saved"],
  clicks: ["clicks", "linkclicks", "urlclicks", "profileclicks"],
};

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const toInt = (v) => Math.max(0, Math.round(Number(String(v ?? "").replace(/[,\s%]/g, "")) || 0));

export function metricsFromCsv(text, fallbackPlatform) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("The file has no data rows.");
  const headers = rows[0].map(norm);
  const col = Object.fromEntries(
    Object.entries(SYNONYMS).map(([key, names]) => [key, headers.findIndex((h) => names.includes(h))]),
  );
  if (col.impressions === -1 && col.likes === -1) throw new Error("Could not find an impressions, views, or likes column.");
  const get = (r, key) => (col[key] >= 0 ? r[col[key]] ?? "" : "");

  return rows.slice(1).map((r) => {
    const date = new Date(get(r, "posted_at"));
    return {
      platform: (get(r, "platform") || fallbackPlatform).slice(0, 120),
      posted_at: Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10),
      title: get(r, "title").replace(/\s+/g, " ").trim().slice(0, 300),
      url: get(r, "url").slice(0, 500),
      impressions: toInt(get(r, "impressions")),
      likes: toInt(get(r, "likes")),
      comments: toInt(get(r, "comments")),
      shares: toInt(get(r, "shares")),
      saves: toInt(get(r, "saves")),
      clicks: toInt(get(r, "clicks")),
    };
  });
}

export const SAMPLE_CSV = `date,platform,title,impressions,likes,comments,shares,saves,clicks
2026-09-01,LinkedIn,Why hourly pricing caps your income,12000,340,45,20,60,85
2026-09-04,Instagram,5 invoice mistakes to avoid,8000,410,32,15,120,0
`;

// Weighted interactions per impression; mirrors backend/api/profile.py.
export function engagementRate(m) {
  const interactions = m.likes + 2 * m.comments + 3 * m.shares + 2 * m.saves;
  return interactions / Math.max(m.impressions, 1);
}
