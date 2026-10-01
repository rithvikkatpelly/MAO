import { makeSlide } from "../lib/project";
import { SlideFrame } from "./SlideFrame";

// Example posts used on the landing and sign-in pages.
export const SAMPLE_BRAND = {
  name: "Maya Chen",
  handle: "@mayacreates",
  mark: "initials",
  logo: "",
  avatar: "",
};

function sample(template, accent, slides, font = "auto") {
  return {
    kind: "carousel",
    size: "portrait",
    cta: "Follow for more",
    slides: slides.map((s) => makeSlide(s)),
    design: { template, accent, font, align: "left", showBrand: true, showNumbers: true, showArrow: true, showCta: true },
  };
}

export const SAMPLES = [
  sample("editorial", "#e11d48", [
    { kicker: "Field notes", headline: "Write less. Say more.", body: "Five editing habits that make every post easier to read." },
  ]),
  sample("midnight", "#ff5a3c", [
    { kicker: "Start here", headline: "One idea, ten posts", body: "How to turn a single insight into a week of content." },
    { kicker: "Step 1", headline: "Find the core claim", body: "" },
  ]),
  sample("bold", "#4f46e5", [{ kicker: "Tip", headline: "Hooks decide everything", body: "People choose to swipe in under a second." }]),
  sample("split", "#0d9488", [{ kicker: "Guide", headline: "Plan a month in an hour", body: "A simple calendar that keeps you consistent." }]),
  sample("gradient", "#9333ea", [{ kicker: "New", headline: "Launch day checklist", body: "Everything to post before, during, and after." }]),
  sample("quote", "#f59e0b", [{ kicker: "", headline: "Consistency beats intensity.", body: "Show up weekly, not perfectly." }]),
  sample("grid", "#2563eb", [{ kicker: "Framework", headline: "The 3 by 3 content grid", body: "Three pillars, three formats, endless ideas." }]),
  sample("minimal", "#16a34a", [{ kicker: "Lesson", headline: "Clarity is a growth strategy", body: "Simple posts get saved and shared." }]),
];

// Three slides fanned out like a hand of cards.
export default function SlideStack({ width = 260, className = "" }) {
  const cards = [SAMPLES[0], SAMPLES[1], SAMPLES[2]];
  const height = (width * 1350) / 1080;
  return (
    <div className={`relative ${className}`} style={{ width: width * 1.9, height: height * 1.12 }} aria-hidden>
      {cards.map((project, i) => (
        <div
          key={i}
          className="absolute top-1/2 left-1/2 overflow-hidden rounded-md shadow-pop ring-1 ring-black/5 transition-transform duration-500"
          style={{
            transform: `translate(-50%, -50%) translateX(${(i - 1) * width * 0.42}px) rotate(${(i - 1) * 7}deg) translateY(${Math.abs(i - 1) * 18}px)`,
            zIndex: i === 1 ? 3 : 1,
          }}
        >
          <SlideFrame project={project} slide={project.slides[0]} index={0} brand={SAMPLE_BRAND} width={width} />
        </div>
      ))}
    </div>
  );
}
