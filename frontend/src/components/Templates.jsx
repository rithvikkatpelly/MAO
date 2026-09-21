const TEMPLATES = [
  { name: "Modern", classes: "bg-navy-950" },
  { name: "Minimal", classes: "bg-white border border-navy-950/10" },
  { name: "Tech Blue", classes: "bg-[#0a66c2]" },
  { name: "Corporate", classes: "bg-navy-700" },
  { name: "Gradient", classes: "bg-gradient-to-br from-coral-500 via-purple-500 to-blue-500" },
];

export default function Templates() {
  return (
    <section id="templates" className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-coral-500">
          Templates
        </span>
        <h2 className="mx-auto mt-3 max-w-xl text-3xl font-bold tracking-tight text-navy-950 sm:text-4xl">
          Pick a look, or let Aurea match your brand
        </h2>

        <div className="mt-14 grid grid-cols-2 gap-6 sm:grid-cols-5">
          {TEMPLATES.map((t) => (
            <div key={t.name} className="flex flex-col items-center gap-3">
              <div
                className={`flex aspect-[3/4] w-full items-center justify-center rounded-2xl shadow-sm ${t.classes}`}
              >
                <div className="h-2/3 w-4/5 rounded-lg bg-white/10 backdrop-blur-sm" />
              </div>
              <span className="text-sm font-semibold text-navy-950">
                {t.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
