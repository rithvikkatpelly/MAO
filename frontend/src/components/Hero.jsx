import {
  Bot,
  Globe,
  Palette,
  UserCheck,
  FileJson,
  FileDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import PhoneMock from "./PhoneMock";
import SlidePreview from "./SlidePreview";

const BADGES = [
  { icon: Bot, label: "Multi-Agent" },
  { icon: Globe, label: "Live Research" },
  { icon: Palette, label: "Brand-Aware" },
  { icon: UserCheck, label: "Human-in-the-Loop" },
  { icon: FileJson, label: "Structured Output" },
  { icon: FileDown, label: "Instant PDF" },
];

export default function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-navy-950 pb-24 pt-16 text-white"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(255,90,60,0.25), transparent 35%), radial-gradient(circle at 85% 0%, rgba(94,120,255,0.25), transparent 40%)",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-2">
        <div>
          <span className="inline-block rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-coral-500">
            Agentic AI Content Studio
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
            Turn one idea into a{" "}
            <span className="text-coral-500">scroll-stopping carousel</span>{" "}
            in minutes
          </h1>

          <p className="mt-6 max-w-lg text-lg text-white/70">
            Aurea's AI agents research your topic, apply your brand voice, and
            draft a ready-to-publish carousel. You just pick the idea and hit
            download.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/app/new"
              className="rounded-full bg-coral-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-coral-500/30 transition hover:bg-coral-600"
            >
              Create Your First Carousel
            </Link>
            <a
              href="#workflow"
              className="rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-white/90 transition hover:border-white/40 hover:bg-white/5"
            >
              See How It Works
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            {BADGES.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80"
              >
                <Icon size={13} className="text-coral-500" />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative flex justify-center lg:justify-end">
          <div className="absolute -left-6 top-10 hidden w-56 rounded-2xl bg-white p-4 text-navy-950 shadow-2xl sm:block">
            <p className="text-xs font-semibold text-navy-800/60">
              Choose a template
            </p>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {["bg-navy-900", "bg-coral-500", "bg-blue-500", "bg-emerald-500", "bg-purple-500"].map(
                (c, i) => (
                  <span
                    key={i}
                    className={`h-6 w-6 rounded-full ${c} ${
                      i === 1 ? "ring-2 ring-offset-2 ring-navy-950" : ""
                    }`}
                  />
                ),
              )}
            </div>
            <p className="mt-4 text-xs font-semibold text-navy-800/60">
              Platform
            </p>
            <div className="mt-2 flex gap-2 text-[11px] font-semibold">
              <span className="rounded-full bg-navy-950 px-3 py-1 text-white">
                LinkedIn
              </span>
              <span className="rounded-full bg-navy-950/5 px-3 py-1 text-navy-950/60">
                Instagram
              </span>
            </div>
          </div>

          <PhoneMock className="rotate-3 shadow-2xl">
            <div className="grid h-full grid-rows-3">
              <SlidePreview
                index={1}
                gradient="navy"
                eyebrow="AI Agents"
                title="Are Changing The Future"
              />
              <SlidePreview
                index={2}
                gradient="coral"
                eyebrow="From Ideas"
                title="To Impact, Automatically"
              />
              <SlidePreview
                index={3}
                gradient="sunset"
                eyebrow="Swipe to Learn"
                title="How the pipeline works"
              />
            </div>
          </PhoneMock>
        </div>
      </div>
    </section>
  );
}
