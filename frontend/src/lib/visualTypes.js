// The diagram catalog: types, their variants, item limits, and the fields each one uses.
// Mirrors backend/agents/visual_tools.py. Rendering lives in visuals.jsx.
//
// Every visual has one shape, so switching type keeps the text:
//   { type, variant, items: [{ label, detail, value, icon, group }], extra: {...}, style: { palette }, alternates }

export const VISUAL_TYPES = {
  process: { label: "Process", family: "Flow", min: 3, max: 6, variants: { chevrons: "Chevrons", numbered: "Numbered", circles: "Circles" } },
  timeline: { label: "Timeline", family: "Flow", min: 3, max: 6, value: "Date or phase", variants: { line: "Line", cards: "Cards" } },
  cycle: { label: "Cycle", family: "Flow", min: 3, max: 6, variants: { ring: "Ring", loop: "Loop" } },
  funnel: { label: "Funnel", family: "Flow", min: 3, max: 5, variants: { stacked: "Funnel", bars: "Bars" } },
  pyramid: { label: "Pyramid", family: "Structure", min: 3, max: 5, variants: { triangle: "Triangle", steps: "Steps" } },
  hub: { label: "Hub and spoke", family: "Structure", min: 3, max: 6, extra: { center: "Center idea" }, variants: { spokes: "Spokes", cards: "Cards" } },
  iconlist: { label: "Icon list", family: "List", min: 3, max: 6, variants: { grid: "Grid", rows: "Rows" } },
  stats: { label: "Big numbers", family: "Data", min: 2, max: 4, value: "Number", variants: { tiles: "Tiles", row: "Row" } },
  bars: { label: "Bar chart", family: "Data", min: 3, max: 6, value: "Value", extra: { suffix: "Unit" }, variants: { horizontal: "Horizontal", columns: "Columns" } },
  comparison: { label: "Comparison", family: "Compare", min: 4, max: 10, groups: true, extra: { left: "Left title", right: "Right title" }, variants: { columns: "Columns", versus: "Versus" } },
  matrix: { label: "2x2 matrix", family: "Compare", min: 4, max: 4, extra: { x_axis: "Horizontal axis", y_axis: "Vertical axis" }, variants: { grid: "Grid", axes: "Axes" } },
  venn: { label: "Venn", family: "Compare", min: 2, max: 3, extra: { overlap: "Overlap" }, variants: { filled: "Filled", outline: "Outline" } },
};

export const VISUAL_TYPE_IDS = Object.keys(VISUAL_TYPES);

export const PALETTES = { brand: "Brand", spectrum: "Spectrum", mono: "Mono" };

export function defaultVariant(type) {
  return Object.keys(VISUAL_TYPES[type].variants)[0];
}

const blankItem = (n) => ({ label: `Point ${n}`, detail: "", value: "", icon: "check", group: 0 });

// Fills missing fields so stored or AI-made visuals always render.
export function normalizeVisual(raw) {
  const type = VISUAL_TYPES[raw?.type] ? raw.type : "iconlist";
  const meta = VISUAL_TYPES[type];
  const items = (Array.isArray(raw?.items) ? raw.items : []).map((i) => ({ ...blankItem(0), label: "", ...i, value: String(i?.value ?? "") }));
  return {
    type,
    variant: meta.variants[raw?.variant] ? raw.variant : defaultVariant(type),
    items,
    extra: { ...(raw?.extra ?? {}) },
    style: { palette: "brand", ...(raw?.style ?? {}) },
    alternates: (raw?.alternates ?? []).filter((t) => VISUAL_TYPES[t] && t !== type),
  };
}

// Switch a visual to another type, keeping its text and clamping the item count.
export function convertVisual(visual, type) {
  const meta = VISUAL_TYPES[type];
  let items = visual.items.map((i) => ({ ...i }));
  if (type === "comparison" && visual.type !== "comparison") {
    const half = Math.ceil(items.length / 2);
    items = items.map((i, n) => ({ ...i, group: n < half ? 0 : 1 }));
  }
  items = items.slice(0, meta.max);
  while (items.length < meta.min) items.push({ ...blankItem(items.length + 1), group: items.length % 2 });
  const extra = { ...visual.extra };
  if (type === "comparison") {
    extra.left ??= "Option A";
    extra.right ??= "Option B";
  }
  if (type === "hub") extra.center ??= "Main idea";
  if (type === "matrix") {
    extra.x_axis ??= "Effort";
    extra.y_axis ??= "Impact";
  }
  if (type === "venn") extra.overlap ??= "Shared";
  const alternates = [visual.type, ...visual.alternates].filter((t, n, all) => t !== type && all.indexOf(t) === n).slice(0, 3);
  return { ...visual, type, variant: defaultVariant(type), items, extra, alternates };
}

// A starter visual for manual insertion.
export function starterVisual(type = "process") {
  return convertVisual(normalizeVisual({ type: "iconlist", items: [] }), type);
}

// The text a visual carries, for the AI "regenerate" call.
export function visualText(visual) {
  return visual.items.map((i) => [i.value, i.label, i.detail].filter(Boolean).join(" ")).join(". ");
}
