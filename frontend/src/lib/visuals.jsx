import { alpha, luminance, mix, onColor, shiftHue } from "./color";
import { SLIDE_ICONS } from "./slideIcons";
import { normalizeVisual } from "./visualTypes";

// Napkin-style diagrams. Each type renders inside a fixed box (w x h, native pixels) with
// inline styles only, so the same markup drives the editor, thumbnails, and exports.
// Wide boxes (deck slides) and tall boxes (carousels, infographic sections) get different layouts.

const BODY = "'Inter Variable', Inter, system-ui, sans-serif";
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---- palette ---------------------------------------------------------------------------

export function visualPalette(t, accent, palette = "brand") {
  const fg = t.fg;
  const dark = luminance(fg) > 0.5; // light text means a dark background
  const mono = t.highlight === t.fg; // templates where the accent is the background
  const base = mono ? fg : t.highlight;
  const tone = (i, n = 4) => {
    const k = n > 1 ? i / (n - 1) : 0;
    if (mono) return mix(fg, accent, 0.1 * (i % 3));
    if (palette === "spectrum") return shiftHue(base, i * 42);
    if (palette === "mono") return base;
    return mix(base, dark ? "#0b1224" : "#ffffff", 0.42 * k);
  };
  return {
    fg,
    muted: t.muted,
    accent: base,
    dark,
    tone,
    on: (hex) => onColor(hex),
    surface: dark ? "rgba(255,255,255,0.07)" : "rgba(17,19,24,0.045)",
    surfaceStrong: dark ? "rgba(255,255,255,0.13)" : "rgba(17,19,24,0.08)",
    line: alpha(dark ? "#ffffff" : "#111318", dark ? 0.28 : 0.2),
  };
}

// ---- building blocks -------------------------------------------------------------------

function Ico({ name, size, color }) {
  const I = SLIDE_ICONS[name] ?? SLIDE_ICONS.check;
  return <I size={size} color={color} strokeWidth={2.2} />;
}

function T({ size, weight = 400, color, font = BODY, align, lines, children, style }) {
  if (!children && children !== 0) return null;
  return (
    <div
      style={{
        fontFamily: font,
        fontSize: size,
        fontWeight: weight,
        color,
        lineHeight: 1.22,
        textAlign: align,
        overflowWrap: "break-word",
        ...(lines ? { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Badge({ size, bg, fg, icon, label, radius = 999 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {label != null ? <span style={{ fontFamily: BODY, fontWeight: 750, fontSize: size * 0.42, color: fg }}>{label}</span> : <Ico name={icon} size={size * 0.5} color={fg} />}
    </div>
  );
}

function Arrow({ size, color, dir = "right" }) {
  const rot = { right: 0, down: 90, left: 180, up: 270 }[dir];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${rot}deg)`, flexShrink: 0 }}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

// Label and detail stacked.
function Copy({ item, c, align = "left", lines = 3, labelColor, detailColor }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 * c.sc, minWidth: 0, textAlign: align }}>
      <T size={c.L} weight={700} font={c.hf} color={labelColor ?? c.p.fg} align={align} lines={2}>
        {item.label}
      </T>
      <T size={c.D} color={detailColor ?? c.p.muted} align={align} lines={lines}>
        {item.detail}
      </T>
    </div>
  );
}

function sizes(n, sc) {
  const f = n <= 3 ? 1.1 : n <= 4 ? 1 : n <= 5 ? 0.92 : 0.85;
  return { L: 30 * sc * f, D: 22 * sc * f, f };
}

// ---- flow --------------------------------------------------------------------------------

function Process({ v, c }) {
  const { items: it, p, w, h, sc, wide } = c;
  const n = it.length;
  const gap = 14 * sc;

  if (v.variant === "numbered") {
    const D = clamp(Math.min(wide ? w / n / 2.6 : h / n / 1.5, 92 * sc), 40 * sc, 92 * sc);
    if (wide) {
      return (
        <div style={{ position: "relative", display: "flex", gap: 24 * sc, width: w, height: h, alignItems: "flex-start", paddingTop: h * 0.3 - D / 2, boxSizing: "border-box" }}>
          <div style={{ position: "absolute", left: w / n / 2, right: w / n / 2, top: h * 0.3 - 2 * sc, height: 4 * sc, background: p.line }} />
          {it.map((item, i) => (
            <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 * sc, position: "relative" }}>
              <Badge size={D} bg={p.tone(i, n)} fg={p.on(p.tone(i, n))} label={i + 1} />
              <Copy item={item} c={c} align="center" lines={4} />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", width: w, height: h }}>
        <div style={{ position: "absolute", left: D / 2 - 2 * sc, top: D / 2, bottom: D / 2, width: 4 * sc, background: p.line }} />
        {it.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 24 * sc, alignItems: "center", position: "relative" }}>
            <Badge size={D} bg={p.tone(i, n)} fg={p.on(p.tone(i, n))} label={i + 1} />
            <Copy item={item} c={c} lines={2} />
          </div>
        ))}
      </div>
    );
  }

  if (v.variant === "circles") {
    const cols = wide ? n : n === 4 ? 2 : Math.min(3, n);
    const rows = Math.ceil(n / cols);
    const cellW = (w - (cols - 1) * 40 * sc) / cols;
    const D = clamp(Math.min(cellW * 0.6, (h / rows) * 0.42), 50 * sc, 150 * sc);
    return (
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignContent: "space-evenly", rowGap: 20 * sc, width: w, height: h }}>
        {it.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", width: cellW + (i % cols < cols - 1 ? 40 * sc : 0) }}>
            <div style={{ width: cellW, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 * sc }}>
              <Badge size={D} bg={p.tone(i, n)} fg={p.on(p.tone(i, n))} icon={item.icon} />
              <Copy item={item} c={c} align="center" lines={3} />
            </div>
            {i % cols < cols - 1 && i < n - 1 && (
              <div style={{ width: 40 * sc, height: D, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Arrow size={34 * sc} color={p.line} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // chevrons
  const notch = 34 * sc;
  if (wide) {
    const chevH = clamp(h * 0.34, 90 * sc, 170 * sc);
    return (
      <div style={{ display: "flex", gap, width: w, height: h, flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 6 * sc }}>
          {it.map((item, i) => {
            const shape = i === 0
              ? `polygon(0 0, calc(100% - ${notch}px) 0, 100% 50%, calc(100% - ${notch}px) 100%, 0 100%)`
              : `polygon(0 0, calc(100% - ${notch}px) 0, 100% 50%, calc(100% - ${notch}px) 100%, 0 100%, ${notch}px 50%)`;
            const bg = p.tone(i, n);
            return (
              <div key={i} style={{ flex: 1, height: chevH, clipPath: shape, background: bg, display: "flex", alignItems: "center", justifyContent: "center", padding: `0 ${notch + 10 * sc}px`, boxSizing: "border-box", gap: 12 * sc }}>
                <T size={c.L * 0.95} weight={750} font={c.hf} color={p.on(bg)} align="center" lines={2}>
                  {item.label}
                </T>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 6 * sc }}>
          {it.map((item, i) => (
            <div key={i} style={{ flex: 1, padding: `0 ${notch * 0.6}px`, display: "flex", flexDirection: "column", gap: 8 * sc }}>
              <T size={c.D * 0.95} weight={700} color={p.accent}>
                {`Step ${i + 1}`}
              </T>
              <T size={c.D} color={p.muted} lines={4}>
                {item.detail}
              </T>
            </div>
          ))}
        </div>
      </div>
    );
  }
  const rowH = (h - (n - 1) * 8 * sc) / n;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 * sc, width: w, height: h }}>
      {it.map((item, i) => {
        const bg = p.tone(i, n);
        const shape = i === n - 1
          ? "none"
          : `polygon(0 0, 100% 0, 100% calc(100% - ${notch * 0.7}px), 50% 100%, 0 calc(100% - ${notch * 0.7}px))`;
        return (
          <div key={i} style={{ display: "flex", gap: 28 * sc, height: rowH, alignItems: "stretch" }}>
            <div style={{ width: w * 0.38, clipPath: shape, background: bg, borderRadius: i === n - 1 ? 14 * sc : 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 * sc, padding: `0 ${18 * sc}px ${i === n - 1 ? 0 : notch * 0.5}px`, boxSizing: "border-box" }}>
              <T size={c.L * 0.9} weight={750} font={c.hf} color={p.on(bg)} align="center" lines={2}>
                {item.label}
              </T>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", minWidth: 0 }}>
              <T size={c.D} color={p.muted} lines={3}>
                {item.detail}
              </T>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Timeline({ v, c }) {
  const { items: it, p, w, h, sc, wide } = c;
  const n = it.length;
  const dot = 26 * sc;

  if (v.variant === "cards") {
    if (wide) {
      return (
        <div style={{ position: "relative", display: "flex", gap: 20 * sc, width: w, height: h, alignItems: "center" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 4 * sc, background: p.line }} />
          {it.map((item, i) => (
            <div key={i} style={{ flex: 1, minWidth: 0, minHeight: h * 0.5, position: "relative", background: p.dark ? "#141b2e" : "#ffffff", border: `${2 * sc}px solid ${p.line}`, borderRadius: 22 * sc, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ background: p.tone(i, n), padding: `${12 * sc}px ${20 * sc}px` }}>
                <T size={c.L * 0.9} weight={800} font={c.hf} color={p.on(p.tone(i, n))}>
                  {item.value || `${i + 1}`}
                </T>
              </div>
              <div style={{ padding: 22 * sc, flex: 1, display: "flex", alignItems: "center" }}>
                <Copy item={item} c={c} lines={4} />
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 * sc, width: w, height: h, justifyContent: "space-between" }}>
        {it.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 20 * sc, alignItems: "stretch", flex: 1, minHeight: 0 }}>
            <div style={{ width: w * 0.22, borderRadius: 18 * sc, background: p.tone(i, n), display: "flex", alignItems: "center", justifyContent: "center", padding: 10 * sc, boxSizing: "border-box" }}>
              <T size={c.L * 0.9} weight={800} font={c.hf} color={p.on(p.tone(i, n))} align="center">
                {item.value || `${i + 1}`}
              </T>
            </div>
            <div style={{ flex: 1, minWidth: 0, background: p.surface, borderRadius: 18 * sc, padding: `${12 * sc}px ${22 * sc}px`, display: "flex", alignItems: "center" }}>
              <Copy item={item} c={c} lines={2} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // line
  if (wide) {
    const lineY = h * 0.34;
    return (
      <div style={{ position: "relative", width: w, height: h }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: lineY - 2 * sc, height: 4 * sc, background: p.line }} />
        <div style={{ display: "flex", width: w, height: h }}>
          {it.map((item, i) => (
            <div key={i} style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", padding: `0 ${10 * sc}px` }}>
              <div style={{ height: lineY - dot / 2 - 14 * sc, display: "flex", alignItems: "flex-end", paddingBottom: 14 * sc, boxSizing: "content-box" }}>
                <T size={c.L * 1.15} weight={800} font={c.hf} color={p.tone(i, n)} align="center">
                  {item.value}
                </T>
              </div>
              <div style={{ width: dot, height: dot, borderRadius: 999, background: p.tone(i, n), boxShadow: `0 0 0 ${7 * sc}px ${alpha(p.tone(i, n), 0.22)}`, flexShrink: 0 }} />
              <div style={{ marginTop: 24 * sc }}>
                <Copy item={item} c={c} align="center" lines={4} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  const valW = w * 0.24;
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", width: w, height: h }}>
      <div style={{ position: "absolute", left: valW + 22 * sc + dot / 2 - 2 * sc, top: dot, bottom: dot, width: 4 * sc, background: p.line }} />
      {it.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 22 * sc, position: "relative" }}>
          <div style={{ width: valW, textAlign: "right" }}>
            <T size={c.L * 1.05} weight={800} font={c.hf} color={p.tone(i, n)} align="right">
              {item.value}
            </T>
          </div>
          <div style={{ width: dot, height: dot, borderRadius: 999, background: p.tone(i, n), boxShadow: `0 0 0 ${7 * sc}px ${alpha(p.tone(i, n), 0.22)}`, flexShrink: 0 }} />
          <Copy item={item} c={c} lines={2} />
        </div>
      ))}
    </div>
  );
}

// Positions around a circle, starting at the top, clockwise.
function around(n, cx, cy, r) {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), cos: Math.cos(a), sin: Math.sin(a), a };
  });
}

// A text block next to a point on a circle, pushed outward.
// In narrow boxes (`stacked`) every label sits above or below its node, so side labels never leave the box.
function Outside({ pt, gapPx, width, stacked, children }) {
  const style = { position: "absolute", width, display: "flex" };
  if (stacked) pt = { ...pt, cos: 0, sin: pt.sin < -0.5 ? -1 : 1 };
  if (pt.cos > 0.35) Object.assign(style, { left: pt.x + gapPx, top: pt.y, transform: "translateY(-50%)" });
  else if (pt.cos < -0.35) Object.assign(style, { left: pt.x - gapPx - width, top: pt.y, transform: "translateY(-50%)", justifyContent: "flex-end" });
  else if (pt.sin < 0) Object.assign(style, { left: pt.x - width / 2, top: pt.y - gapPx, transform: "translateY(-100%)", justifyContent: "center" });
  else Object.assign(style, { left: pt.x - width / 2, top: pt.y + gapPx, justifyContent: "center" });
  const align = pt.cos > 0.35 ? "left" : pt.cos < -0.35 ? "right" : "center";
  return <div style={style}>{children(align)}</div>;
}

// Font size that fits the longest word of a centered label inside a circle.
function circleText(text, d, sc) {
  const longest = Math.max(4, ...String(text).split(/\s+/).map((w) => w.length));
  return clamp(Math.min(d / 6, (d * 0.74) / (longest * 0.6)), 16 * sc, 40 * sc);
}

function Ring({ c, center, spokes = false, arcs = false }) {
  const { items: it, p, w, h, sc, wide } = c;
  const n = it.length;
  const cx = w / 2;
  const cy = h / 2;
  // Leave room above and below the ring for the top and bottom labels.
  const D = clamp(Math.min(h, w) * 0.13, 56 * sc, 116 * sc);
  const labelH = c.L * 1.3 + c.D * 1.25 * 2 + 16 * sc;
  const r = Math.max(D, Math.min(h / 2 - D / 2 - labelH, wide ? w * 0.2 : w * 0.33));
  const pts = around(n, cx, cy, r);
  const labelW = wide ? Math.min(w * 0.27, 380 * sc) : Math.min(w * 0.28, 260 * sc);
  const hubD = center != null ? clamp(r * (wide ? 0.9 : 0.72), 110 * sc, 260 * sc) : 0;
  const arcGap = Math.asin(Math.min(0.9, (D / 2 + 14 * sc) / r)) * 2;

  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <marker id="vArrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={p.line} />
          </marker>
        </defs>
        {spokes && pts.map((pt, i) => <line key={i} x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke={p.line} strokeWidth={4 * sc} />)}
        {arcs &&
          pts.map((pt, i) => {
            const a1 = pt.a + arcGap / 2;
            const a2 = pts[(i + 1) % n].a + (i === n - 1 ? 2 * Math.PI : 0) - arcGap / 2;
            const x1 = cx + r * Math.cos(a1);
            const y1 = cy + r * Math.sin(a1);
            const x2 = cx + r * Math.cos(a2);
            const y2 = cy + r * Math.sin(a2);
            return <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} fill="none" stroke={p.line} strokeWidth={5 * sc} markerEnd="url(#vArrow)" />;
          })}
      </svg>
      {center != null && (
        <div style={{ position: "absolute", left: cx - hubD / 2, top: cy - hubD / 2, width: hubD, height: hubD, borderRadius: 999, background: p.accent, display: "flex", alignItems: "center", justifyContent: "center", padding: hubD * 0.14, boxSizing: "border-box" }}>
          <T size={circleText(center, hubD, sc)} weight={800} font={c.hf} color={p.on(p.accent)} align="center" lines={3} style={{ overflowWrap: "normal" }}>
            {center}
          </T>
        </div>
      )}
      {center == null && arcs && (
        <div style={{ position: "absolute", left: cx - 40 * sc, top: cy - 40 * sc, width: 80 * sc, height: 80 * sc, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.6 }}>
          <Ico name="repeat" size={64 * sc} color={p.muted} />
        </div>
      )}
      {pts.map((pt, i) => (
        <div key={i}>
          <div style={{ position: "absolute", left: pt.x - D / 2, top: pt.y - D / 2 }}>
            <Badge size={D} bg={p.tone(i, n)} fg={p.on(p.tone(i, n))} icon={it[i].icon} />
          </div>
          <Outside pt={pt} gapPx={D / 2 + 14 * sc} width={labelW} stacked={!wide}>
            {(align) => <Copy item={it[i]} c={c} align={align} lines={2} />}
          </Outside>
        </div>
      ))}
    </div>
  );
}

function Cycle({ v, c }) {
  if (v.variant !== "loop") return <Ring c={c} arcs />;
  const { items: it, p, w, h, sc, wide } = c;
  const n = it.length;
  const pad = 46 * sc;
  return (
    <div style={{ position: "relative", width: w, height: h, boxSizing: "border-box", padding: wide ? `0 0 ${pad}px` : `0 0 0 ${pad}px` }}>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <marker id="vLoop" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0L10 5L0 10z" fill={p.line} />
          </marker>
        </defs>
        {wide ? (
          <path d={`M ${w - w / n / 2} ${h - pad - 10 * sc} V ${h - 14 * sc} H ${w / n / 2} V ${h - pad + 4 * sc}`} fill="none" stroke={p.line} strokeWidth={5 * sc} strokeDasharray={`${14 * sc} ${10 * sc}`} markerEnd="url(#vLoop)" />
        ) : (
          <path d={`M ${pad + 10 * sc} ${h - h / n / 2} H ${14 * sc} V ${h / n / 2} H ${pad - 4 * sc}`} fill="none" stroke={p.line} strokeWidth={5 * sc} strokeDasharray={`${14 * sc} ${10 * sc}`} markerEnd="url(#vLoop)" />
        )}
      </svg>
      <div style={{ display: "flex", flexDirection: wide ? "row" : "column", gap: 0, width: "100%", height: "100%", position: "relative" }}>
        {it.map((item, i) => (
          <div key={i} style={{ display: "flex", flexDirection: wide ? "row" : "column", alignItems: "center", flex: 1, minWidth: 0, minHeight: 0 }}>
            <div style={{ flex: 1, alignSelf: "stretch", background: p.surface, borderRadius: 20 * sc, padding: 20 * sc, display: "flex", flexDirection: wide ? "column" : "row", justifyContent: wide ? "center" : "flex-start", gap: 14 * sc, alignItems: wide ? "flex-start" : "center", minWidth: 0, minHeight: 0, borderTop: wide ? `${6 * sc}px solid ${p.tone(i, n)}` : "none", borderLeft: wide ? "none" : `${6 * sc}px solid ${p.tone(i, n)}` }}>
              <Badge size={56 * sc} bg={p.tone(i, n)} fg={p.on(p.tone(i, n))} icon={item.icon} radius={16 * sc} />
              <Copy item={item} c={c} lines={wide ? 4 : 2} />
            </div>
            {i < n - 1 && (
              <div style={{ padding: 8 * sc }}>
                <Arrow size={30 * sc} color={p.line} dir={wide ? "right" : "down"} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Layers with text on the right, shared by funnel and pyramid.
function Layered({ c, shapeFor, labelInside = true }) {
  const { items: it, p, w, h, sc, wide } = c;
  const n = it.length;
  const gap = 8 * sc;
  const shapeW = wide ? w * 0.42 : w * 0.5;
  const layerH = (h - gap * (n - 1)) / n;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, width: w, height: h }}>
      {it.map((item, i) => {
        const bg = p.tone(i, n);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 30 * sc, height: layerH }}>
            <div style={{ width: shapeW, height: "100%", position: "relative", flexShrink: 0 }}>
              <div style={{ position: "absolute", inset: 0, clipPath: shapeFor(i, n), background: bg }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: `0 ${shapeW * 0.22}px`, gap: 10 * sc }}>
                {labelInside ? (
                  <T size={c.L * 0.92} weight={750} font={c.hf} color={p.on(bg)} align="center" lines={2}>
                    {item.value ? `${item.value} ${item.label}` : item.label}
                  </T>
                ) : (
                  <Ico name={item.icon} size={Math.min(layerH * 0.42, 48 * sc)} color={p.on(bg)} />
                )}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 * sc, borderLeft: `${3 * sc}px solid ${alpha(bg, 0.6)}`, paddingLeft: 20 * sc }}>
              {!labelInside && (
                <T size={c.L * 0.92} weight={700} font={c.hf} color={p.fg} lines={1}>
                  {item.label}
                </T>
              )}
              <T size={c.D} color={p.muted} lines={labelInside ? 3 : 2}>
                {item.detail}
              </T>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Funnel({ v, c }) {
  if (v.variant === "bars") {
    return <Layered c={c} shapeFor={(i, n) => {
      const inset = (i * 34) / n;
      return `inset(0 ${inset}% 0 ${inset}% round ${14 * c.sc}px)`;
    }} />;
  }
  return <Layered c={c} shapeFor={(i, n) => {
    const top = (i * 60) / n / 2;
    const bot = ((i + 1) * 60) / n / 2;
    return `polygon(${top}% 0, ${100 - top}% 0, ${100 - bot}% 100%, ${bot}% 100%)`;
  }} />;
}

function Pyramid({ v, c }) {
  if (v.variant === "steps") {
    return <Layered c={c} shapeFor={(i, n) => {
      const inset = ((n - 1 - i) * 40) / n;
      return `inset(0 ${inset}% 0 ${inset}% round ${10 * c.sc}px)`;
    }} />;
  }
  return <Layered c={c} labelInside={false} shapeFor={(i, n) => {
    const top = 50 - (i * 50) / n;
    const bot = 50 - ((i + 1) * 50) / n;
    return `polygon(${top}% 0, ${100 - top}% 0, ${100 - bot}% 100%, ${bot}% 100%)`;
  }} />;
}

// ---- lists and structure --------------------------------------------------------------

function IconList({ v, c }) {
  const { items: it, p, w, h, sc, wide } = c;
  const n = it.length;
  if (v.variant === "rows") {
    const cols = wide && n > 3 ? 2 : 1;
    const rows = Math.ceil(n / cols);
    return (
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, columnGap: 40 * sc, width: w, height: h }}>
        {it.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 24 * sc, borderBottom: Math.floor(i / cols) < rows - 1 ? `${2 * sc}px solid ${p.line}` : "none", minHeight: 0 }}>
            <Badge size={clamp((h / rows) * 0.5, 44 * sc, 76 * sc)} bg={p.tone(i, n)} fg={p.on(p.tone(i, n))} icon={item.icon} radius={18 * sc} />
            <Copy item={item} c={c} lines={2} />
          </div>
        ))}
      </div>
    );
  }
  const veryWide = w / h > 2.6;
  const cols = wide ? (n === 4 ? (veryWide ? 4 : 2) : Math.min(3, n)) : n <= 3 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const horizontal = cols === 1 || (wide && cols === 2);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: "auto", alignContent: "center", gap: 20 * sc, width: w, height: h }}>
      {it.map((item, i) => (
        <div key={i} style={{ background: p.surface, borderRadius: 24 * sc, padding: 30 * sc, maxHeight: (h - 20 * sc * (rows - 1)) / rows, display: "flex", flexDirection: horizontal ? "row" : "column", alignItems: horizontal ? "center" : "flex-start", justifyContent: "center", gap: 16 * sc, minHeight: 0, minWidth: 0, overflow: "hidden" }}>
          <Badge size={64 * sc} bg={p.tone(i, n)} fg={p.on(p.tone(i, n))} icon={item.icon} radius={18 * sc} />
          <Copy item={item} c={c} lines={horizontal ? 2 : 4} />
        </div>
      ))}
    </div>
  );
}

function Hub({ v, c }) {
  const center = v.extra.center || "Main idea";
  if (v.variant !== "cards") return <Ring c={c} center={center} spokes />;
  const { items: it, p, w, h, sc, wide } = c;
  const n = it.length;
  const hubD = clamp(Math.min(w, h) * 0.34, 140 * sc, 280 * sc);
  const card = (item, i) => (
    <div key={i} style={{ background: p.surface, borderRadius: 20 * sc, padding: 20 * sc, display: "flex", gap: 14 * sc, alignItems: "center", minHeight: 0, borderLeft: `${6 * sc}px solid ${p.tone(i, n)}` }}>
      <Ico name={item.icon} size={36 * sc} color={p.tone(i, n)} />
      <Copy item={item} c={c} lines={2} />
    </div>
  );
  const hub = (
    <div style={{ width: hubD, height: hubD, borderRadius: 999, background: p.accent, display: "flex", alignItems: "center", justifyContent: "center", padding: hubD * 0.14, boxSizing: "border-box", flexShrink: 0, boxShadow: `0 0 0 ${14 * sc}px ${alpha(p.accent, 0.18)}` }}>
      <T size={circleText(center, hubD, sc)} weight={800} font={c.hf} color={p.on(p.accent)} align="center" lines={3} style={{ overflowWrap: "normal" }}>
        {center}
      </T>
    </div>
  );
  if (wide) {
    const left = it.filter((_, i) => i % 2 === 0);
    const right = it.filter((_, i) => i % 2 === 1);
    const col = (list, offset) => <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 * sc, justifyContent: "center", minWidth: 0 }}>{list.map((item, k) => card(item, k * 2 + offset))}</div>;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 40 * sc, width: w, height: h }}>
        {col(left, 0)}
        {hub}
        {col(right, 1)}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 * sc, width: w, height: h }}>
      {hub}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 * sc, width: "100%", flex: 1, minHeight: 0 }}>{it.map(card)}</div>
    </div>
  );
}

// ---- data ----------------------------------------------------------------------------------

function Stats({ v, c }) {
  const { items: it, p, w, h, sc, wide } = c;
  const n = it.length;
  // Largest size at which the number fits its column on one line (bold digits and % run up to 0.74em wide).
  const valueSize = (text, cols, inset = 56 * sc) => clamp(((w - 20 * sc * (cols - 1)) / cols - inset) / (Math.max(2, String(text).length) * 0.74), 30 * sc, 140 * sc);
  if (v.variant === "row") {
    if (wide || n <= 2) {
      return (
        <div style={{ display: "flex", width: w, height: h, alignItems: "center" }}>
          {it.map((item, i) => (
            <div key={i} style={{ flex: 1, minWidth: 0, padding: `0 ${28 * sc}px`, borderLeft: i ? `${3 * sc}px solid ${p.line}` : "none", display: "flex", flexDirection: "column", gap: 10 * sc }}>
              <T size={valueSize(item.value, n)} weight={800} font={c.hf} color={p.tone(i, n)} style={{ lineHeight: 1, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
                {item.value}
              </T>
              <Copy item={item} c={c} lines={3} />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", width: w, height: h }}>
        {it.map((item, i) => (
          <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 28 * sc, borderTop: i ? `${3 * sc}px solid ${p.line}` : "none" }}>
            <T size={valueSize(item.value, 1, w * 0.58)} weight={800} font={c.hf} color={p.tone(i, n)} style={{ lineHeight: 1, width: w * 0.42, flexShrink: 0, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
              {item.value}
            </T>
            <Copy item={item} c={c} lines={2} />
          </div>
        ))}
      </div>
    );
  }
  const cols = wide ? n : n <= 2 ? n : 2;
  const rows = Math.ceil(n / cols);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 20 * sc, width: w, height: h }}>
      {it.map((item, i) => (
        <div key={i} style={{ background: p.surface, borderRadius: 26 * sc, padding: 28 * sc, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 * sc, minHeight: 0, minWidth: 0, overflow: "hidden", borderTop: `${8 * sc}px solid ${p.tone(i, n)}` }}>
          <T size={valueSize(item.value, cols)} weight={800} font={c.hf} color={p.tone(i, n)} style={{ lineHeight: 1, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
            {item.value}
          </T>
          <Copy item={item} c={c} lines={2} />
        </div>
      ))}
    </div>
  );
}

function num(value) {
  const n = parseFloat(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function Bars({ v, c }) {
  const { items: it, p, w, h, sc } = c;
  const n = it.length;
  const max = Math.max(1, ...it.map((i) => Math.abs(num(i.value))));
  const suffix = v.extra.suffix ?? "";
  if (v.variant === "columns") {
    const labelH = 70 * sc;
    const valueH = 54 * sc;
    const plotH = h - labelH - valueH;
    return (
      <div style={{ display: "flex", gap: 24 * sc, width: w, height: h, alignItems: "flex-end", borderBottom: `${3 * sc}px solid ${p.line}` }}>
        {it.map((item, i) => {
          const bh = Math.max(6 * sc, (Math.abs(num(item.value)) / max) * plotH);
          return (
            <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              <T size={c.L} weight={800} font={c.hf} color={p.fg} align="center">
                {`${item.value}${suffix}`}
              </T>
              <div style={{ width: "72%", height: bh, marginTop: 10 * sc, borderRadius: `${14 * sc}px ${14 * sc}px 0 0`, background: p.tone(i, n) }} />
              <div style={{ height: labelH, display: "flex", alignItems: "center" }}>
                <T size={c.D} color={p.muted} align="center" lines={2}>
                  {item.label}
                </T>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  const rowGap = 18 * sc;
  const barH = clamp((h - rowGap * (n - 1)) / n - 46 * sc, 22 * sc, 64 * sc);
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: rowGap, width: w, height: h }}>
      {it.map((item, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 * sc }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 * sc }}>
            <T size={c.D * 1.1} color={p.muted} lines={1}>
              {item.label}
            </T>
            <T size={c.D * 1.15} weight={800} color={p.fg}>
              {`${item.value}${suffix}`}
            </T>
          </div>
          <div style={{ height: barH, borderRadius: 12 * sc, background: p.surfaceStrong, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(2, (Math.abs(num(item.value)) / max) * 100)}%`, height: "100%", borderRadius: 12 * sc, background: p.tone(i, n) }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- compare ---------------------------------------------------------------------------

function Comparison({ v, c }) {
  const { items: it, p, w, h, sc } = c;
  const left = it.filter((i) => !i.group);
  const right = it.filter((i) => i.group);
  const titles = [v.extra.left || "Option A", v.extra.right || "Option B"];
  const colors = [p.tone(0, 2), p.palette === "brand" ? (p.dark ? "#5b6478" : "#8a8f99") : p.tone(1, 2)];
  const rows = Math.max(left.length, right.length, 1);
  const pointSize = clamp(c.L * (rows > 4 ? 0.85 : 1), 18 * sc, 36 * sc);

  if (v.variant === "versus") {
    const vsD = 84 * sc;
    return (
      <div style={{ display: "flex", flexDirection: "column", width: w, height: h, gap: 12 * sc }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 * sc }}>
          {[0, 1].map((side) => (
            <div key={side} style={{ flex: 1, order: side * 2, background: colors[side], borderRadius: 18 * sc, padding: `${18 * sc}px ${24 * sc}px` }}>
              <T size={c.L} weight={800} font={c.hf} color={p.on(colors[side])} align="center" lines={1}>
                {titles[side]}
              </T>
            </div>
          ))}
          <div style={{ order: 1, width: vsD, height: vsD, borderRadius: 999, background: p.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: BODY, fontWeight: 850, fontSize: 30 * sc, color: p.on(p.fg) }}>VS</span>
          </div>
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} style={{ flex: 1, display: "flex", alignItems: "center", gap: 20 * sc, borderBottom: r < rows - 1 ? `${2 * sc}px solid ${p.line}` : "none", minHeight: 0 }}>
            <T size={pointSize} color={p.fg} align="center" lines={2} style={{ flex: 1 }}>
              {left[r]?.label}
            </T>
            <div style={{ width: vsD, display: "flex", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ width: 10 * sc, height: 10 * sc, borderRadius: 999, background: p.line }} />
            </div>
            <T size={pointSize} color={p.fg} align="center" lines={2} style={{ flex: 1 }}>
              {right[r]?.label}
            </T>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 24 * sc, width: w, height: h }}>
      {[left, right].map((list, side) => (
        <div key={side} style={{ flex: 1, minWidth: 0, background: p.surface, borderRadius: 26 * sc, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ background: colors[side], padding: `${22 * sc}px ${28 * sc}px` }}>
            <T size={c.L * 1.05} weight={800} font={c.hf} color={p.on(colors[side])} lines={1}>
              {titles[side]}
            </T>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-evenly", padding: `${10 * sc}px ${28 * sc}px` }}>
            {list.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 16 * sc, alignItems: "flex-start" }}>
                <span style={{ width: pointSize * 0.5, height: pointSize * 0.5, borderRadius: 999, background: colors[side], marginTop: pointSize * 0.38, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <T size={pointSize} color={p.fg} lines={2}>
                    {item.label}
                  </T>
                  {item.detail && (
                    <T size={c.D * 0.9} color={p.muted} lines={1}>
                      {item.detail}
                    </T>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Matrix({ v, c }) {
  const { items: it, p, w, h, sc } = c;
  const q = [0, 1, 2, 3].map((i) => it[i] ?? { label: "", detail: "", icon: "check" });
  const axisW = 54 * sc;
  const xLabel = v.extra.x_axis || "";
  const yLabel = v.extra.y_axis || "";

  if (v.variant === "axes") {
    const cx = w / 2;
    const cy = h / 2;
    return (
      <div style={{ position: "relative", width: w, height: h }}>
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <marker id="vAxis" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0 0L10 5L0 10z" fill={p.fg} />
            </marker>
          </defs>
          <line x1={20 * sc} y1={cy} x2={w - 20 * sc} y2={cy} stroke={p.fg} strokeWidth={4 * sc} markerEnd="url(#vAxis)" />
          <line x1={cx} y1={h - 20 * sc} x2={cx} y2={20 * sc} stroke={p.fg} strokeWidth={4 * sc} markerEnd="url(#vAxis)" />
        </svg>
        <div style={{ position: "absolute", right: 24 * sc, top: cy + 14 * sc }}>
          <T size={c.D} weight={700} color={p.muted}>{xLabel}</T>
        </div>
        <div style={{ position: "absolute", left: cx + 18 * sc, top: 14 * sc }}>
          <T size={c.D} weight={700} color={p.muted}>{yLabel}</T>
        </div>
        {q.map((item, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          return (
            <div key={i} style={{ position: "absolute", left: col ? cx + 30 * sc : 30 * sc, top: row ? cy + 50 * sc : 60 * sc, width: w / 2 - 60 * sc, height: h / 2 - 110 * sc, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 * sc }}>
              <Badge size={64 * sc} bg={p.tone(i, 4)} fg={p.on(p.tone(i, 4))} icon={item.icon} />
              <Copy item={item} c={c} align="center" lines={2} />
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", width: w, height: h, gap: 12 * sc }}>
      <div style={{ width: axisW, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: "rotate(-90deg)", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 10 * sc }}>
          <T size={c.D} weight={700} color={p.muted}>{yLabel}</T>
          <Arrow size={26 * sc} color={p.muted} />
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 * sc, minWidth: 0 }}>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 14 * sc, minHeight: 0 }}>
          {q.map((item, i) => {
            const hot = i === 1;
            const bg = hot ? p.accent : p.surface;
            const fg = hot ? p.on(p.accent) : p.fg;
            return (
              <div key={i} style={{ background: bg, borderRadius: 22 * sc, padding: 24 * sc, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 * sc, minHeight: 0, overflow: "hidden" }}>
                <Ico name={item.icon} size={44 * sc} color={hot ? fg : p.tone(i, 4)} />
                <Copy item={item} c={c} lines={3} labelColor={fg} detailColor={hot ? alpha(fg, 0.82) : p.muted} />
              </div>
            );
          })}
        </div>
        <div style={{ height: axisW, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 * sc }}>
          <T size={c.D} weight={700} color={p.muted}>{xLabel}</T>
          <Arrow size={26 * sc} color={p.muted} />
        </div>
      </div>
    </div>
  );
}

function Venn({ v, c }) {
  const { items: it, p, w, h, sc, wide } = c;
  const n = Math.min(3, Math.max(2, it.length));
  const items = it.slice(0, n);
  const hasDetails = items.some((i) => i.detail);
  const areaW = wide && hasDetails ? w * 0.56 : w;
  const areaH = !wide && hasDetails ? h * 0.68 : h;
  const r = n === 2 ? Math.min(areaW / 3.3, areaH / 2.1) : Math.min(areaW / 3.4, areaH / 3.3);
  const cx = areaW / 2;
  const cy = areaH / 2 + (n === 3 ? r * 0.15 : 0);
  const centers = n === 2
    ? [{ x: cx - r * 0.6, y: cy, dx: -1, dy: 0 }, { x: cx + r * 0.6, y: cy, dx: 1, dy: 0 }]
    : around(3, cx, cy, r * 0.62).map((pt) => ({ x: pt.x, y: pt.y, dx: pt.cos, dy: pt.sin }));
  const outline = v.variant === "outline";
  const legend = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 * sc, minWidth: 0 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 16 * sc, alignItems: "flex-start" }}>
          <span style={{ width: 22 * sc, height: 22 * sc, borderRadius: 999, background: p.tone(i, n), marginTop: 6 * sc, flexShrink: 0 }} />
          <Copy item={item} c={c} lines={2} />
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: wide ? "row" : "column", width: w, height: h, gap: 20 * sc }}>
      <div style={{ position: "relative", width: areaW, height: areaH, flexShrink: 0 }}>
        <svg width={areaW} height={areaH} style={{ position: "absolute", inset: 0 }}>
          {centers.map((ct, i) => (
            <circle key={i} cx={ct.x} cy={ct.y} r={r} fill={alpha(p.tone(i, n), outline ? 0.08 : 0.5)} stroke={p.tone(i, n)} strokeWidth={outline ? 6 * sc : 0} />
          ))}
        </svg>
        {centers.map((ct, i) => (
          <div key={i} style={{ position: "absolute", left: ct.x + ct.dx * r * 0.45 - r * 0.5, top: ct.y + ct.dy * r * 0.45, width: r, display: "flex", justifyContent: "center", transform: "translateY(-50%)" }}>
            <T size={clamp(r / 7, 18 * sc, c.L)} weight={800} font={c.hf} color={p.fg} align="center" lines={3}>
              {items[i].label}
            </T>
          </div>
        ))}
        <div style={{ position: "absolute", left: cx - r * 0.4, top: (n === 2 ? cy : cy + r * 0.02) - 24 * sc, width: r * 0.8, display: "flex", justifyContent: "center" }}>
          <T size={c.D * 1.05} weight={800} color={p.fg} align="center" lines={2}>
            {v.extra.overlap}
          </T>
        </div>
      </div>
      {hasDetails && legend}
    </div>
  );
}

const RENDERERS = {
  process: Process,
  timeline: Timeline,
  cycle: Cycle,
  funnel: Funnel,
  pyramid: Pyramid,
  hub: Hub,
  iconlist: IconList,
  stats: Stats,
  bars: Bars,
  comparison: Comparison,
  matrix: Matrix,
  venn: Venn,
};

// One diagram in a w x h box. `t` is the slide template theme; `accent` the design accent.
// `boost` enlarges text for formats read on a phone at full width (infographics).
export function VisualBlock({ visual: raw, t, accent, w, h, headFont, boost = 1 }) {
  const v = normalizeVisual(raw);
  const p = { ...visualPalette(t, accent, v.style.palette), palette: v.style.palette };
  const sc = clamp(Math.min(w / 900, h / 520) * boost, 0.66, 1.6);
  const n = Math.max(1, v.items.length);
  const { L, D } = sizes(n, sc);
  const c = { items: v.items, p, w, h, sc, wide: w / h > 1.35, L, D, hf: headFont ?? BODY };
  const Render = RENDERERS[v.type];
  return (
    <div style={{ width: w, height: h, position: "relative", overflow: "hidden", flexShrink: 0 }}>
      <Render v={v} c={c} />
    </div>
  );
}
