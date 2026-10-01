import { useEffect, useRef, useState } from "react";

// A click-to-open panel anchored under its trigger. `trigger` gets { open, toggle }.
export default function Popover({ trigger, children, align = "right", width = "w-80" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          role="dialog"
          className={`animate-fade-in absolute top-full z-50 mt-1.5 ${width} max-w-[calc(100vw-2rem)] ${align === "right" ? "right-0" : "left-0"} rounded-xl border border-line bg-white p-4 shadow-pop`}
        >
          {typeof children === "function" ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  );
}
