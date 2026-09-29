import { alpha, mix, onColor, shiftHue } from "./color";
import { sizeOf } from "./formats";

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

function BrandTag({ brand, u, fg, muted, accent }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 * u, minWidth: 0 }}>
      <div
        style={{
          width: 56 * u,
          height: 56 * u,
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
      <div style={{ fontFamily: BODY_FONT, lineHeight: 1.2, minWidth: 0 }}>
        <div style={{ fontSize: 24 * u, fontWeight: 650, color: fg }}>{brand.name}</div>
        {brand.handle && <div style={{ fontSize: 21 * u, color: muted }}>{brand.handle}</div>}
      </div>
    </div>
  );
}

export function SlideCanvas({ project, slide, index, brand }) {
  const { w, h } = sizeOf(project);
  const { design } = project;
  const u = Math.min(w, h) / 1080;
  const landscape = w > h;
  const tpl = TEMPLATES[design.template] ?? TEMPLATES.midnight;
  const t = tpl.theme(design.accent);
  const headFont = (FONTS[design.font] ?? FONTS[tpl.font]).css;

  const total = project.slides.length;
  const multi = total > 1;
  const isLast = index === total - 1;
  const center = design.align === "center";
  const pad = (landscape ? 72 : 88) * u;

  const showCta = design.showCta && isLast && project.cta;
  const showArrow = design.showArrow && multi && !isLast;
  const pageLabel = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

  // In the split layout the top (or left) block is accent-colored.
  const blockFg = onColor(design.accent);

  const header = (onBlock) => {
    const fg = onBlock ? blockFg : t.fg;
    const muted = onBlock ? alpha(blockFg, 0.72) : t.muted;
    if (!design.showBrand && !(design.showNumbers && multi)) return null;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 * u }}>
        {design.showBrand ? (
          <BrandTag brand={brand} u={u} fg={fg} muted={muted} accent={onBlock || t.highlight === t.fg ? fg : design.accent} />
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

  const headlineSize = 92 * u * headlineScale(slide.headline, multi && index === 0) * (landscape ? 0.92 : 1);
  const bodySize = 34 * u * (slide.body.length > 160 ? 0.86 : 1);

  const content = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: center ? "center" : "flex-start", textAlign: center ? "center" : "left", gap: 28 * u }}>
      {t.quote && (
        <div style={{ fontFamily: FONTS.dmserif.css, fontSize: 240 * u, lineHeight: 0.6, height: 110 * u, color: t.highlight }}>&ldquo;</div>
      )}
      {slide.kicker && (
        <div style={{ display: "flex", alignItems: "center", gap: 14 * u }}>
          {!center && <span style={{ width: 36 * u, height: 5 * u, borderRadius: 9, background: t.highlight }} />}
          <span style={{ fontFamily: BODY_FONT, fontSize: 23 * u, fontWeight: 650, letterSpacing: "0.14em", textTransform: "uppercase", color: t.highlight }}>
            {slide.kicker}
          </span>
        </div>
      )}
      {slide.headline && (
        <div
          style={{
            fontFamily: headFont,
            fontSize: headlineSize,
            fontWeight: t.weight,
            fontStyle: t.quote ? "italic" : "normal",
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
      )}
      {slide.body && (
        <div style={{ fontFamily: BODY_FONT, fontSize: bodySize, lineHeight: 1.45, color: t.muted, maxWidth: center ? "86%" : "90%", whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
          {slide.body}
        </div>
      )}
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
        <div style={{ flex: 1, padding: pad, display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box", gap: 32 * u }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>{content}</div>
          {footer}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...root, padding: pad, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 32 * u }}>
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
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: center ? "center" : "flex-start", position: "relative" }}>
        {content}
      </div>
      {footer ?? <span />}
    </div>
  );
}
