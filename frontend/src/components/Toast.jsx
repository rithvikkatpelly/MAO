import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

const ToastContext = createContext(() => {});

const TONES = {
  success: { icon: CheckCircle2, className: "text-emerald-500" },
  error: { icon: AlertCircle, className: "text-red-500" },
  info: { icon: Info, className: "text-subtle" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (message, { tone = "success", duration = 3200 } = {}) => {
      const id = ++nextId.current;
      setToasts((all) => [...all.slice(-3), { id, message, tone }]);
      setTimeout(() => dismiss(id), tone === "error" ? duration * 2 : duration);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map(({ id, message, tone }) => {
          const { icon: Icon, className } = TONES[tone] ?? TONES.info;
          return (
            <div
              key={id}
              role={tone === "error" ? "alert" : "status"}
              className="animate-toast-in pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-pop"
            >
              <Icon size={17} className={`mt-px shrink-0 ${className}`} />
              <span className="flex-1">{message}</span>
              <button onClick={() => dismiss(id)} className="-mr-1 text-white/50 hover:text-white" aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
