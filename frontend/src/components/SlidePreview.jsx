const GRADIENTS = {
  navy: "from-navy-900 via-navy-800 to-navy-700",
  coral: "from-coral-600 via-coral-500 to-orange-400",
  sunset: "from-purple-600 via-coral-500 to-orange-400",
  mint: "from-emerald-600 via-teal-500 to-cyan-400",
};

export default function SlidePreview({
  gradient = "navy",
  index = 1,
  title = "AI Agents Are Changing The Future",
  eyebrow = "From Ideas to Impact",
  compact = false,
}) {
  return (
    <div
      className={`flex h-full w-full flex-col justify-between bg-gradient-to-br ${GRADIENTS[gradient]} text-left text-white ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-semibold tracking-wide backdrop-blur-sm">
          {String(index).padStart(2, "0")}
        </span>
        <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
      </div>
      <div>
        <p className="mb-1 text-[8px] uppercase tracking-widest text-white/70">
          {eyebrow}
        </p>
        <p className="text-xs font-semibold leading-snug">{title}</p>
      </div>
    </div>
  );
}
