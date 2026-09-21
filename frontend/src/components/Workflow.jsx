import { MessageSquarePlus, SearchCheck, MousePointerClick, FileDown } from "lucide-react";
import PhoneMock from "./PhoneMock";
import SlidePreview from "./SlidePreview";

const STEPS = [
  {
    icon: MessageSquarePlus,
    title: "Describe Your Topic",
    desc: "Tell Aurea what you want to post about and which platform it's for.",
    gradient: "navy",
    eyebrow: "Step 01",
    slide: "Prompt: AI agents in 2026",
  },
  {
    icon: SearchCheck,
    title: "Agents Research & Draft",
    desc: "Research, brand-context and content agents work in parallel behind the scenes.",
    gradient: "coral",
    eyebrow: "Step 02",
    slide: "3 ideas ready for review",
  },
  {
    icon: MousePointerClick,
    title: "Review & Pick an Idea",
    desc: "You choose the angle you like best — that's the only manual step.",
    gradient: "sunset",
    eyebrow: "Step 03",
    slide: "Selected: Idea #2",
  },
  {
    icon: FileDown,
    title: "Download Your Carousel",
    desc: "Get a polished, on-brand carousel PDF, ready to publish.",
    gradient: "mint",
    eyebrow: "Step 04",
    slide: "carousel.pdf ready",
  },
];

export default function Workflow() {
  return (
    <section id="workflow" className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-coral-500">
          How It Works
        </span>
        <h2 className="mx-auto mt-3 max-w-xl text-3xl font-bold tracking-tight text-navy-950 sm:text-4xl">
          From prompt to published post
        </h2>

        <div className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, desc, gradient, eyebrow, slide }) => (
            <div key={title} className="flex flex-col items-center">
              <PhoneMock accent="coral">
                <SlidePreview index={1} gradient={gradient} eyebrow={eyebrow} title={slide} />
              </PhoneMock>
              <span className="mt-6 flex h-10 w-10 items-center justify-center rounded-full bg-coral-500/10 text-coral-500">
                <Icon size={18} />
              </span>
              <h3 className="mt-3 text-base font-semibold text-navy-950">
                {title}
              </h3>
              <p className="mt-2 max-w-[220px] text-sm text-navy-800/60">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
