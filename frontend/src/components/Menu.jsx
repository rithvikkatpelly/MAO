import { useEffect, useRef, useState } from "react";

// A small dropdown menu. `trigger` receives { open, toggle } and returns the button.
export function Menu({ trigger, items, align = "right", width = "w-56", up = false }) {
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
          role="menu"
          className={`animate-fade-in absolute z-50 ${up ? "bottom-full mb-1.5" : "top-full mt-1.5"} ${width} ${
            align === "right" ? "right-0" : "left-0"
          } rounded-xl border border-line bg-white p-1 shadow-pop`}
        >
          {items.filter(Boolean).map((item, i) =>
            item === "divider" ? (
              <div key={`d${i}`} className="my-1 h-px bg-line" />
            ) : (
              <button
                key={item.label}
                role="menuitem"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick();
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition disabled:opacity-40 ${
                  item.danger ? "text-red-600 hover:bg-red-50" : "text-ink hover:bg-paper"
                }`}
              >
                {item.icon && <item.icon size={15} className={item.danger ? "" : "text-muted"} />}
                <span className="flex-1">
                  {item.label}
                  {item.hint && <span className="block text-xs text-subtle">{item.hint}</span>}
                </span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
