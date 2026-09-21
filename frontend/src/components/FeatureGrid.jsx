import {
  Search,
  Database,
  Palette,
  PenTool,
  LayoutTemplate,
  ShieldCheck,
} from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "Live Trend Research",
    desc: "Web and news search surface 3–5 fresh content ideas for your topic.",
  },
  {
    icon: Database,
    title: "Deep Context Gathering",
    desc: "A dedicated research agent pulls facts and sources for your selected idea.",
  },
  {
    icon: Palette,
    title: "Brand-Aware Voice",
    desc: "Tone, audience and past posts are pulled in so every carousel sounds like you.",
  },
  {
    icon: PenTool,
    title: "Structured Content Generation",
    desc: "Slides, headlines, CTAs and visuals are generated as validated JSON.",
  },
  {
    icon: LayoutTemplate,
    title: "5 Ready-Made Templates",
    desc: "Modern, Minimal, Tech Blue, Corporate and Gradient styles out of the box.",
  },
  {
    icon: ShieldCheck,
    title: "Human-in-the-Loop",
    desc: "You approve the idea before content generation — no surprise posts.",
  },
];

export default function FeatureGrid() {
  return (
    <section id="features" className="bg-cream-50 py-24">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-coral-500">
          Everything You Need
        </span>
        <h2 className="mx-auto mt-3 max-w-xl text-3xl font-bold tracking-tight text-navy-950 sm:text-4xl">
          One studio, every step of the workflow
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-6 text-left sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-navy-950/5 bg-white p-6 shadow-sm shadow-navy-950/5 transition hover:-translate-y-1 hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-950 text-coral-500">
                <Icon size={20} />
              </span>
              <h3 className="mt-4 text-base font-semibold text-navy-950">
                {title}
              </h3>
              <p className="mt-2 text-sm text-navy-800/60">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
