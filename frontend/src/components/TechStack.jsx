const STACK = [
  "FastAPI",
  "LangGraph",
  "Google Gemini",
  "PostgreSQL",
  "Python",
  "Docker",
];

export default function TechStack() {
  return (
    <section id="stack" className="bg-cream-50 py-20">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-coral-500">
          Built On
        </span>
        <h2 className="mx-auto mt-3 max-w-lg text-2xl font-bold tracking-tight text-navy-950 sm:text-3xl">
          A modern, production-ready agent stack
        </h2>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          {STACK.map((item) => (
            <span
              key={item}
              className="rounded-full border border-navy-950/10 bg-white px-6 py-3 text-sm font-semibold text-navy-950 shadow-sm"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
