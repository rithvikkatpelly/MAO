import PhoneMock from "./PhoneMock";
import SlidePreview from "./SlidePreview";

const STATS = [
  { value: "4+", label: "Specialized Agents" },
  { value: "3–5", label: "Ideas Per Research Pass" },
  { value: "50+", label: "Templates & Layouts" },
];

export default function StatsBand() {
  return (
    <section className="relative overflow-hidden bg-navy-950 py-24 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 40px)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Powered by a real{" "}
            <span className="text-coral-500">multi-agent pipeline</span>,
            not a single prompt
          </h2>
          <p className="mt-5 max-w-md text-white/70">
            A research agent, a brand-context agent, and a content agent hand
            off state through LangGraph — with you approving the idea before
            anything gets drafted.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-6">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-bold text-coral-500 sm:text-4xl">
                  {s.value}
                </p>
                <p className="mt-1 text-xs font-medium text-white/60">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-6 lg:justify-end">
          <PhoneMock accent="coral" className="-rotate-6">
            <div className="grid h-full grid-rows-2">
              <SlidePreview index={1} gradient="coral" eyebrow="Draft" title="Research complete" />
              <SlidePreview index={2} gradient="navy" eyebrow="Review" title="Pick your idea" />
            </div>
          </PhoneMock>
          <PhoneMock accent="coral" className="mt-10 rotate-6">
            <div className="grid h-full grid-rows-2">
              <SlidePreview index={1} gradient="mint" eyebrow="Final" title="Brand voice applied" />
              <SlidePreview index={2} gradient="sunset" eyebrow="Ready" title="Download PDF" />
            </div>
          </PhoneMock>
        </div>
      </div>
    </section>
  );
}
