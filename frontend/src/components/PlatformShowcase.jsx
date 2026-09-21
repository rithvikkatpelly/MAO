import PhoneMock from "./PhoneMock";
import SlidePreview from "./SlidePreview";

const PLATFORMS = [
  { name: "LinkedIn", gradient: "navy", color: "bg-[#0a66c2]" },
  { name: "Instagram", gradient: "sunset", color: "bg-gradient-to-tr from-purple-600 to-orange-400" },
  { name: "X / Twitter", gradient: "coral", color: "bg-navy-950" },
  { name: "Threads", gradient: "mint", color: "bg-navy-800" },
];

export default function PlatformShowcase() {
  return (
    <section className="bg-cream-50 py-24">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-coral-500">
          One Studio, Every Platform
        </span>
        <h2 className="mx-auto mt-3 max-w-xl text-3xl font-bold tracking-tight text-navy-950 sm:text-4xl">
          Carousels tuned to each platform's format
        </h2>

        <div className="mt-14 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {PLATFORMS.map((p, i) => (
            <div key={p.name} className="flex flex-col items-center gap-5">
              <PhoneMock accent={i % 2 === 0 ? "coral" : "navy"}>
                <div className="grid h-full grid-rows-2">
                  <SlidePreview
                    index={1}
                    gradient={p.gradient}
                    eyebrow={p.name}
                    title="AI Agents Are Changing The Future"
                  />
                  <SlidePreview
                    index={2}
                    gradient={p.gradient}
                    eyebrow="Swipe →"
                    title="See the full workflow"
                  />
                </div>
              </PhoneMock>
              <span
                className={`rounded-full px-4 py-1.5 text-xs font-semibold text-white ${p.color}`}
              >
                {p.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
