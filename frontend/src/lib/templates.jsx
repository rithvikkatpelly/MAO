import { alpha, luminance, mix, onColor, shiftHue } from "./color";
import { CUSTOM_PREFIX, customFontCss } from "./fonts";
import { sizeOf } from "./formats";
import { SLIDE_ICONS } from "./slideIcons";
import { VisualBlock } from "./visuals";

// Slides render at their native pixel size with inline styles only, so the
// same markup drives the editor preview, the thumbnails, and the exported files.

export const FONTS = {
  inter: { label: "Inter", css: "'Inter Variable', Inter, system-ui, sans-serif" },
  grotesk: { label: "Space Grotesk", css: "'Space Grotesk Variable', 'Inter Variable', sans-serif" },
  fraunces: { label: "Fraunces", css: "'Fraunces Variable', Georgia, serif" },
  dmserif: { label: "DM Serif", css: "'DM Serif Display', Georgia, serif" },
};

const BODY_FONT = FONTS.inter.css;

export const TEMPLATES = {
  midnight: {
    label: "Midnight",
    font: "inter",
    theme: (a) => ({
      bg: "#0b1224",
      layers: [
        `radial-gradient(circle at 92% 6%, ${alpha(a, 0.5)}, transparent 46%)`,
        `radial-gradient(circle at 0% 100%, ${alpha(a, 0.16)}, transparent 42%)`,
      ],
      fg: "#ffffff",
      muted: "rgba(255,255,255,0.68)",
      highlight: a,
      weight: 750,
    }),
  },
  editorial: {
    label: "Editorial",
    font: "fraunces",
    theme: (a) => ({
      bg: "#f4efe6",
      fg: "#1c1a17",
      muted: "rgba(28,26,23,0.66)",
      highlight: mix(a, "#1c1a17", 0.15),
      weight: 560,
      rule: true,
    }),
  },
  bold: {
    label: "Bold",
    font: "grotesk",
    theme: (a) => {
      const fg = onColor(a);
      return {
        bg: a,
        fg,
        muted: alpha(fg, 0.8),
        highlight: fg,
        weight: 700,
        bigNumber: true,
      };
    },
  },
  minimal: {
    label: "Minimal",
    font: "inter",
    theme: (a) => ({
      bg: "#ffffff",
      fg: "#111318",
      muted: "#5f6470",
      highlight: a,
      weight: 650,
    }),
  },
  gradient: {
    label: "Gradient",
    font: "inter",
    theme: (a) => {
      const fg = onColor(a);
      return {
        bg: `linear-gradient(140deg, ${shiftHue(a, -28)} 0%, ${a} 50%, ${mix(shiftHue(a, 30), "#000000", 0.12)} 100%)`,
        layers: [`radial-gradient(circle at 20% 15%, rgba(255,255,255,0.22), transparent 40%)`],
        fg,
        muted: alpha(fg, 0.84),
        highlight: fg,
        weight: 750,
      };
    },
  },
  split: {
    label: "Split",
    font: "grotesk",
    theme: (a) => ({
      bg: "#ffffff",
      fg: "#111318",
      muted: "#5f6470",
      highlight: a,
      weight: 700,
      split: true,
    }),
  },
  grid: {
    label: "Blueprint",
    font: "grotesk",
    theme: (a) => ({
      bg: "#f6f6f1",
      grid: "rgba(17,19,24,0.07)",
      fg: "#111318",
      muted: "#555a66",
      highlight: a,
      weight: 650,
    }),
  },
  quote: {
    label: "Quote",
    font: "dmserif",
    theme: (a) => ({
      bg: "#141414",
      fg: "#f5f5f4",
      muted: "rgba(245,245,244,0.62)",
      highlight: a,
      weight: 400,
      quote: true,
    }),
  },
};

export const TEMPLATE_IDS = Object.keys(TEMPLATES);

function initials(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "A"
  );
}

function headlineScale(text, isHook) {
  const n = text.length;
  const base = n <= 24 ? 1.15 : n <= 48 ? 1 : n <= 80 ? 0.84 : n <= 120 ? 0.7 : 0.58;
  return isHook ? base * 1.1 : base;
}

function Arrow({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function BrandTag({ brand, u, fg, muted, accent, darkBg }) {
  const size = 56 * u;
  const useLogo = brand.mark === "logo" && brand.logo;
  const useAvatar = brand.mark === "avatar" && brand.avatar;

  let mark;
  if (useLogo) {
    mark = (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: darkBg ? `${8 * u}px ${14 * u}px` : 0,
          borderRadius: 14 * u,
          background: darkBg ? "rgba(255,255,255,0.95)" : "transparent",
          flexShrink: 0,
        }}
      >
        <img src={brand.logo} alt="" style={{ display: "block", height: darkBg ? size - 16 * u : size, maxWidth: 240 * u, objectFit: "contain" }} />
      </div>
    );
  } else if (useAvatar) {
    mark = <img src={brand.avatar} alt="" style={{ width: size, height: size, borderRadius: 999, objectFit: "cover", flexShrink: 0, display: "block" }} />;
  } else {
    mark = (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          background: accent,
          color: onColor(accent),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: BODY_FONT,
          fontWeight: 700,
          fontSize: 22 * u,
          flexShrink: 0,
        }}
      >
        {initials(brand.name)}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 * u, minWidth: 0 }}>
      {mark}
      <div style={{ fontFamily: BODY_FONT, lineHeight: 1.2, minWidth: 0 }}>
        {!useLogo && <div style={{ fontSize: 24 * u, fontWeight: 650, color: fg }}>{brand.name}</div>}
        {brand.handle && <div style={{ fontSize: 21 * u, color: useLogo ? fg : muted, fontWeight: useLogo ? 600 : 400 }}>{brand.handle}</div>}
      </div>
    </div>
  );
}

// Slide layouts. "standard" is headline and body; the others add structured content.
export const LAYOUTS = {
  standard: { label: "Text" },
  stat: { label: "Stat" },
  list: { label: "List" },
  chart: { label: "Chart" },
  code: { label: "Code" },
  image: { label: "Screenshot" },
  sources: { label: "Sources" },
  visual: { label: "Diagram" },
};

const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

function domainOf(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function CheckBullet({ size, bg, fg }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 999, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l5 5L20 7" />
      </svg>
    </span>
  );
}

const DESIGN_DEFAULTS = {
  template: "midnight",
  accent: "#ff5a3c",
  font: "auto",
  align: "left",
  showBrand: true,
  showNumbers: true,
  showArrow: true,
  showCta: true,
};

// The template theme, fonts, and accent for a project (shared by slides, infographics, and previews).
export function themeFor(project) {
  const design = { ...DESIGN_DEFAULTS, ...project.design, accent: /^#[0-9a-f]{6}$/i.test(project.design?.accent ?? "") ? project.design.accent : DESIGN_DEFAULTS.accent };
  const tpl = TEMPLATES[design.template] ?? TEMPLATES.midnight;
  const headFont = design.font?.startsWith(CUSTOM_PREFIX)
    ? customFontCss(design.font.slice(CUSTOM_PREFIX.length))
    : (FONTS[design.font] ?? FONTS[tpl.font]).css;
  return { design, tpl, t: tpl.theme(design.accent), headFont };
}

// Rough rendered height of a block of text, for sizing the diagram box under a headline.
function textHeight(text, fontSize, width, lineHeight) {
  if (!text) return 0;
  const lines = text.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil((line.length * fontSize * 0.52) / width)), 0);
  return lines * fontSize * lineHeight;
}

export function SlideCanvas({ project, slide: rawSlide, index, brand }) {
  const { w, h } = sizeOf(project);
  // Projects come from the server as stored JSON; fill anything missing instead of crashing.
  const design = { ...DESIGN_DEFAULTS, ...project.design, accent: /^#[0-9a-f]{6}$/i.test(project.design?.accent ?? "") ? project.design.accent : DESIGN_DEFAULTS.accent };
  const slide = { kicker: "", headline: "", body: "", ...rawSlide };
  const u = Math.min(w, h) / 1080;
  const landscape = w > h;
  const tpl = TEMPLATES[design.template] ?? TEMPLATES.midnight;
  const photo = slide.bg?.src;
  const layout = slide.layout ?? "standard";

  // A background photo turns any template into white text over a darkened image.
  let t = tpl.theme(design.accent);
  if (photo) {
    t = { ...t, fg: "#ffffff", muted: "rgba(255,255,255,0.86)", highlight: design.accent, rule: false, grid: null, split: false, bigNumber: false, layers: null, bg: "#111111" };
  }
  const headFont = design.font?.startsWith(CUSTOM_PREFIX)
    ? customFontCss(design.font.slice(CUSTOM_PREFIX.length))
    : (FONTS[design.font] ?? FONTS[tpl.font]).css;

  const total = project.slides?.length || 1;
  const multi = total > 1;
  const isLast = index === total - 1;
  const center = design.align === "center";
  const pad = (landscape ? 72 : 88) * u;
  const layer = { position: "relative", zIndex: 1 };

  const showCta = design.showCta && isLast && project.cta;
  const showArrow = design.showArrow && multi && !isLast && project.kind !== "deck";
  const pageLabel = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

  // In the split layout the top (or left) block is accent-colored.
  const blockFg = onColor(design.accent);

  const header = (onBlock) => {
    const fg = onBlock ? blockFg : t.fg;
    const muted = onBlock ? alpha(blockFg, 0.72) : t.muted;
    if (!design.showBrand && !(design.showNumbers && multi)) return null;
    return (
      <div style={{ ...layer, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 * u }}>
        {design.showBrand ? (
          <BrandTag
            brand={brand}
            u={u}
            fg={fg}
            muted={muted}
            accent={onBlock || t.highlight === t.fg ? fg : design.accent}
            darkBg={onBlock ? onColor(design.accent) === "#ffffff" : luminance(t.fg) > 0.5}
          />
        ) : (
          <span />
        )}
        {design.showNumbers && multi && (
          <span style={{ fontFamily: BODY_FONT, fontSize: 22 * u, fontWeight: 600, color: muted, letterSpacing: "0.06em", fontVariantNumeric: "tabular-nums" }}>
            {pageLabel}
          </span>
        )}
      </div>
    );
  };

  const footer =
    showCta || showArrow ? (
      <div
        style={{
          ...layer,
          display: "flex",
          alignItems: "center",
          justifyContent: showCta && center ? "center" : showCta ? "flex-start" : "flex-end",
          ...(t.rule ? { borderTop: `${2 * u}px solid ${alpha(t.fg, 0.14)}`, paddingTop: 28 * u } : {}),
        }}
      >
        {showCta && (
          <span
            style={{
              fontFamily: BODY_FONT,
              fontSize: 26 * u,
              fontWeight: 650,
              padding: `${18 * u}px ${34 * u}px`,
              borderRadius: 999,
              background: t.highlight,
              color: onColor(t.highlight),
            }}
          >
            {project.cta}
          </span>
        )}
        {showArrow && (
          <span style={{ display: "flex", alignItems: "center", gap: 12 * u, fontFamily: BODY_FONT, fontSize: 22 * u, fontWeight: 600, color: t.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Swipe <Arrow size={30 * u} color={t.muted} />
          </span>
        )}
      </div>
    ) : null;

  // ---- building blocks
  const Icon = SLIDE_ICONS[slide.icon];
  const iconEl = Icon && (
    <div style={{ width: 92 * u, height: 92 * u, borderRadius: 24 * u, background: t.highlight, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon size={50 * u} color={onColor(t.highlight)} strokeWidth={2} />
    </div>
  );

  const kickerText = slide.kicker || (layout === "sources" ? "Sources" : "");
  const kickerEl = kickerText && (
    <div style={{ display: "flex", alignItems: "center", gap: 14 * u }}>
      {!center && <span style={{ width: 36 * u, height: 5 * u, borderRadius: 9, background: t.highlight }} />}
      <span style={{ fontFamily: BODY_FONT, fontSize: 23 * u, fontWeight: 650, letterSpacing: "0.14em", textTransform: "uppercase", color: t.highlight }}>
        {kickerText}
      </span>
    </div>
  );

  const headlineEl = (scale = 1) =>
    slide.headline && design.showTitle !== false && (
      <div
        style={{
          fontFamily: headFont,
          fontSize: 92 * u * headlineScale(slide.headline, multi && index === 0 && layout === "standard") * (landscape ? 0.92 : 1) * scale,
          fontWeight: t.weight,
          fontStyle: t.quote && layout === "standard" ? "italic" : "normal",
          lineHeight: 1.06,
          letterSpacing: t.quote || headFont.includes("Serif") ? "-0.01em" : "-0.03em",
          color: t.fg,
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
          maxWidth: "100%",
        }}
      >
        {slide.headline}
      </div>
    );

  const bodyEl =
    slide.body && (
      <div style={{ fontFamily: BODY_FONT, fontSize: 34 * u * (slide.body.length > 160 ? 0.86 : 1), lineHeight: 1.45, color: t.muted, maxWidth: center ? "86%" : "90%", whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
        {slide.body}
      </div>
    );

  let blocks;
  let fullWidth = false;
  if (layout === "visual" && slide.visual) {
    // The diagram fills whatever the header, footer, and headline leave.
    const boxW = t.split ? (landscape ? w * 0.6 : w) - 2 * pad : w - 2 * pad;
    const regionH = t.split && !landscape ? h * 0.62 : h;
    const headSize = 92 * u * headlineScale(slide.headline, false) * (landscape ? 0.92 : 1) * 0.6;
    const reserved =
      2 * pad +
      (t.split ? 0 : (design.showBrand || (design.showNumbers && multi) ? 60 * u : 0) + 32 * u) +
      (footer ? 90 * u : 0) +
      (kickerText ? 23 * u * 1.4 + 28 * u : 0) +
      (slide.headline && design.showTitle !== false ? textHeight(slide.headline, headSize, boxW, 1.06) + 28 * u : 0) +
      (slide.body ? textHeight(slide.body, 28 * u, boxW * 0.9, 1.45) + 28 * u : 0) +
      12 * u;
    fullWidth = true;
    blocks = [
      kickerEl,
      headlineEl(0.6),
      slide.body && (
        <div key="vb" style={{ fontFamily: BODY_FONT, fontSize: 28 * u, lineHeight: 1.45, color: t.muted, maxWidth: "90%", whiteSpace: "pre-wrap" }}>
          {slide.body}
        </div>
      ),
      <VisualBlock key="visual" visual={slide.visual} t={t} accent={design.accent} w={boxW} h={Math.max(200 * u, regionH - reserved)} headFont={headFont} />,
    ];
  } else if (layout === "stat") {
    const value = slide.stat?.value || "0";
    blocks = [
      iconEl,
      kickerEl,
      <div key="stat" style={{ fontFamily: headFont, fontSize: 250 * u * (value.length > 5 ? 5.5 / value.length : 1) * (landscape ? 0.8 : 1), fontWeight: 800, lineHeight: 0.92, letterSpacing: "-0.05em", color: t.highlight }}>
        {value}
      </div>,
      headlineEl(0.55),
      bodyEl,
    ];
  } else if (layout === "list") {
    const items = (slide.items ?? []).filter(Boolean).slice(0, 6);
    fullWidth = true;
    blocks = [
      iconEl,
      kickerEl,
      headlineEl(0.72),
      items.length > 0 && (
        <div key="list" style={{ display: "flex", flexDirection: "column", gap: 22 * u, width: "100%" }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 22 * u, justifyContent: center ? "center" : "flex-start" }}>
              <CheckBullet size={44 * u} bg={t.highlight} fg={onColor(t.highlight)} />
              <span style={{ fontFamily: BODY_FONT, fontSize: 34 * u * (items.length > 4 ? 0.9 : 1), lineHeight: 1.35, color: t.fg, paddingTop: 2 * u }}>{item}</span>
            </div>
          ))}
        </div>
      ),
      bodyEl,
    ];
  } else if (layout === "chart") {
    const rows = (slide.chart?.rows ?? []).filter((r) => r.label || r.value).slice(0, 6);
    const max = Math.max(1, ...rows.map((r) => Math.abs(Number(r.value) || 0)));
    fullWidth = true;
    blocks = [
      kickerEl,
      headlineEl(0.66),
      rows.length > 0 && (
        <div key="chart" style={{ display: "flex", flexDirection: "column", gap: 20 * u, width: "100%" }}>
          {rows.map((r, i) => {
            const v = Number(r.value) || 0;
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 * u }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: BODY_FONT, fontSize: 26 * u }}>
                  <span style={{ color: t.muted }}>{r.label}</span>
                  <span style={{ color: t.fg, fontWeight: 700 }}>
                    {r.value}
                    {slide.chart?.suffix ?? ""}
                  </span>
                </div>
                <div style={{ height: 40 * u, borderRadius: 12 * u, background: alpha(luminance(t.fg) > 0.5 ? "#ffffff" : "#000000", 0.1), overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(2, (Math.abs(v) / max) * 100)}%`, height: "100%", borderRadius: 12 * u, background: i === 0 ? t.highlight : alpha(t.highlight, 0.7) }} />
                </div>
              </div>
            );
          })}
        </div>
      ),
      bodyEl,
    ];
  } else if (layout === "code") {
    const code = slide.code ?? "";
    const lines = code.split("\n").length;
    fullWidth = true;
    blocks = [
      kickerEl,
      headlineEl(0.6),
      code && (
        <div key="code" style={{ width: "100%", background: "#0d1117", borderRadius: 22 * u, padding: 34 * u, boxSizing: "border-box", boxShadow: `0 ${20 * u}px ${50 * u}px rgba(0,0,0,0.25)` }}>
          <div style={{ display: "flex", gap: 10 * u, marginBottom: 22 * u }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <span key={c} style={{ width: 16 * u, height: 16 * u, borderRadius: 999, background: c }} />
            ))}
          </div>
          <pre style={{ margin: 0, fontFamily: MONO, fontSize: 26 * u * (lines > 14 ? 0.8 : 1), lineHeight: 1.5, color: "#e6edf3", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{code}</pre>
        </div>
      ),
      bodyEl,
    ];
  } else if (layout === "image") {
    fullWidth = true;
    blocks = [
      kickerEl,
      headlineEl(0.66),
      bodyEl,
      slide.image && (
        <img
          key="shot"
          src={slide.image}
          alt=""
          style={{ display: "block", width: "100%", maxHeight: h * (landscape ? 0.46 : 0.42), objectFit: "contain", borderRadius: 18 * u, boxShadow: `0 ${18 * u}px ${46 * u}px rgba(0,0,0,0.22)`, background: "#ffffff" }}
        />
      ),
    ];
  } else if (layout === "sources") {
    const sources = (slide.sources?.length ? slide.sources : project.sources ?? []).slice(0, 6);
    fullWidth = true;
    blocks = [
      kickerEl,
      headlineEl(0.6),
      <div key="src" style={{ display: "flex", flexDirection: "column", gap: 24 * u, width: "100%" }}>
        {sources.map((src, i) => (
          <div key={i} style={{ display: "flex", gap: 20 * u, alignItems: "baseline" }}>
            <span style={{ fontFamily: BODY_FONT, fontSize: 24 * u, fontWeight: 700, color: t.highlight, minWidth: 36 * u }}>{i + 1}</span>
            <span style={{ fontFamily: BODY_FONT, lineHeight: 1.3 }}>
              <span style={{ display: "block", fontSize: 28 * u, color: t.fg }}>{src.title}</span>
              <span style={{ display: "block", fontSize: 21 * u, color: t.muted }}>{domainOf(src.url)}</span>
            </span>
          </div>
        ))}
      </div>,
    ];
  } else {
    blocks = [
      t.quote && (
        <div key="q" style={{ fontFamily: FONTS.dmserif.css, fontSize: 240 * u, lineHeight: 0.6, height: 110 * u, color: t.highlight }}>
          &ldquo;
        </div>
      ),
      iconEl,
      kickerEl,
      headlineEl(1),
      bodyEl,
    ];
  }

  const content = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: center ? "center" : "flex-start",
        textAlign: center ? "center" : "left",
        gap: 28 * u,
        width: fullWidth ? "100%" : undefined,
      }}
    >
      {blocks.filter(Boolean).map((b, i) => (
        <div key={i} style={{ display: "contents" }}>
          {b}
        </div>
      ))}
    </div>
  );

  const root = {
    width: w,
    height: h,
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
    color: t.fg,
    ...(t.grid
      ? {
          backgroundColor: t.bg,
          backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`,
          backgroundSize: `${54 * u}px ${54 * u}px`,
        }
      : { background: [...(t.layers ?? []), t.bg].join(", ") }),
  };

  if (t.split) {
    const blockSize = landscape ? "40%" : "38%";
    return (
      <div style={{ ...root, display: "flex", flexDirection: landscape ? "row" : "column" }}>
        <div
          style={{
            flex: `0 0 ${blockSize}`,
            background: design.accent,
            padding: pad,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxSizing: "border-box",
          }}
        >
          {header(true) ?? <span />}
          <div style={{ fontFamily: headFont, fontSize: (landscape ? 170 : 210) * u, fontWeight: 700, lineHeight: 0.85, letterSpacing: "-0.05em", color: alpha(blockFg, 0.92) }}>
            {String(index + 1).padStart(2, "0")}
          </div>
        </div>
        <div style={{ flex: 1, padding: pad, display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box", gap: 32 * u, minHeight: 0 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", minHeight: 0 }}>{content}</div>
          {footer}
        </div>
      </div>
    );
  }

  const dim = slide.bg?.dim ?? 0.45;
  return (
    <div style={{ ...root, padding: pad, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 32 * u }}>
      {photo && (
        <>
          <img src={photo} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, rgba(0,0,0,${Math.min(0.92, dim + 0.3)}), rgba(0,0,0,${dim}))` }} />
        </>
      )}
      {t.bigNumber && multi && (
        <div
          style={{
            position: "absolute",
            right: pad * 0.6,
            bottom: pad * 0.2,
            fontFamily: headFont,
            fontSize: 520 * u,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "-0.06em",
            color: alpha(t.fg, 0.08),
            pointerEvents: "none",
          }}
        >
          {index + 1}
        </div>
      )}
      {header(false) ?? <span />}
      <div style={{ ...layer, flex: 1, display: "flex", alignItems: "center", justifyContent: center ? "center" : "flex-start", minHeight: 0 }}>{content}</div>
      {footer ?? <span />}
    </div>
  );
}

