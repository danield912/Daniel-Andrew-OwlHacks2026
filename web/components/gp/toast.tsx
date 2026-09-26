"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { Portal } from "./portal";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; title: string; body?: string };
type ToastInput = { title: string; body?: string };

type ToastApi = {
  success: (input: ToastInput | string) => void;
  error: (input: ToastInput | string) => void;
  info: (input: ToastInput | string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const look: Record<ToastKind, { icon: typeof Info; ring: string; iconClass: string }> = {
  success: { icon: CheckCircle2, ring: "ring-mint-300/30", iconClass: "text-mint-300" },
  error: { icon: AlertTriangle, ring: "ring-rose-400/30", iconClass: "text-rose-300" },
  info: { icon: Info, ring: "ring-sky-300/30", iconClass: "text-sky-300" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, input: ToastInput | string) => {
    const toast = { id: nextId.current++, kind, ...(typeof input === "string" ? { title: input } : input) };
    setToasts(current => [...current.slice(-3), toast]);
    setTimeout(() => dismiss(toast.id), kind === "error" ? 6000 : 3600);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: input => push("success", input),
    error: input => push("error", input),
    info: input => push("info", input),
  }), [push]);

  return <ToastContext.Provider value={api}>
    {children}
    <Portal>
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] z-[80] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map(toast => {
            const { icon: Icon, ring, iconClass } = look[toast.kind];
            return <motion.div
              key={toast.id}
              layout
              role={toast.kind === "error" ? "alert" : "status"}
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-night-800/95 p-4 shadow-lift ring-1 backdrop-blur-xl ${ring}`}
            >
              <motion.span
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.05 }}
                className={`mt-0.5 ${iconClass}`}
              >
                <Icon size={20} aria-hidden="true" />
              </motion.span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{toast.title}</p>
                {toast.body && <p className="mt-0.5 text-sm text-slate-300">{toast.body}</p>}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(toast.id)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </motion.div>;
          })}
        </AnimatePresence>
      </div>
    </Portal>
  </ToastContext.Provider>;
}

export function useToast() {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider");
  return api;
}
