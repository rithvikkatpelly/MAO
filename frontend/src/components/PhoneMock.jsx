export default function PhoneMock({ accent = "coral", className = "", children }) {
  const ring =
    accent === "coral"
      ? "ring-coral-500/40"
      : accent === "navy"
        ? "ring-navy-700/40"
        : "ring-navy-700/40";

  return (
    <div
      className={`relative w-[150px] shrink-0 rounded-[22px] border-[6px] border-navy-950 bg-navy-950 shadow-xl ring-4 ${ring} ${className}`}
    >
      <div className="absolute left-1/2 top-1 h-1 w-8 -translate-x-1/2 rounded-full bg-navy-800" />
      <div className="aspect-[9/19] w-full overflow-hidden rounded-[16px] bg-white">
        {children}
      </div>
    </div>
  );
}
