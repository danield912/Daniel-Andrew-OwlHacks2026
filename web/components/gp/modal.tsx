"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Portal } from "./portal";

function useOverlayBehavior(open: boolean, onClose: () => void, locked: boolean, panel: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(() => {
      const target = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ??
        panel.current?.querySelector<HTMLElement>("button, a[href], input, select, textarea");
      target?.focus();
    }, 60);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !locked) onClose();
      if (event.key === "Tab" && panel.current) {
        // Keep keyboard focus inside the dialog.
        const items = [...panel.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])")];
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose, locked, panel]);
}

// Centered dialog that springs open and fades closed.
export function Modal({ open, onClose, title, description, children, locked = false, tone = "default" }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  locked?: boolean; // true while an action runs, so it can't be closed mid-way
  tone?: "default" | "danger";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useOverlayBehavior(open, onClose, locked, panel);

  return <Portal>
    <AnimatePresence>
      {open && <div className="fixed inset-0 z-[70] grid place-items-center p-4">
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 bg-night-950/75 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !locked && onClose()}
        />
        <motion.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          initial={{ opacity: 0, scale: 0.9, y: 20, rotateX: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          style={{ transformPerspective: 900 }}
          className={cn(
            "relative w-full max-w-md rounded-3xl border bg-night-800/95 p-6 shadow-lift backdrop-blur-xl sm:p-8",
            tone === "danger" ? "border-rose-400/25" : "border-white/10",
          )}
        >
          <h2 id={titleId} className="pr-8 font-display text-xl font-bold text-white">{title}</h2>
          {description && <div id={descId} className="mt-2 text-slate-300">{description}</div>}
          {!locked && <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white">
            <X size={18} aria-hidden="true" />
          </button>}
          <div className="mt-6">{children}</div>
        </motion.div>
      </div>}
    </AnimatePresence>
  </Portal>;
}

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return desktop;
}

// Slide-in panel: from the right on desktop, a bottom sheet on phones.
export function Sheet({ open, onClose, title, subtitle, header, children, footer }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const desktop = useIsDesktop();
  useOverlayBehavior(open, onClose, false, panel);

  return <Portal>
    <AnimatePresence>
      {open && <div className="fixed inset-0 z-[60]">
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 bg-night-950/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={desktop ? { x: "100%" } : { y: "100%" }}
          animate={{ x: 0, y: 0 }}
          exit={desktop ? { x: "100%" } : { y: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
          className={cn(
            "absolute flex flex-col overflow-hidden border-white/10 bg-night-850/95 shadow-lift backdrop-blur-2xl",
            "inset-x-0 bottom-0 max-h-[92svh] rounded-t-[28px] border-t",
            "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[min(560px,92vw)] md:rounded-none md:rounded-l-[28px] md:border-l md:border-t-0",
          )}
        >
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-white/20 md:hidden" aria-hidden="true" />
          <div className="relative shrink-0">
            {header}
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5 sm:px-8">
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-2xl font-bold text-white">{title}</h2>
                {subtitle && <div className="mt-1 text-sm text-slate-300">{subtitle}</div>}
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-xl bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-8 sm:px-8">{children}</div>
          {footer && <div className="shrink-0 border-t border-white/10 bg-night-900/80 px-6 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] sm:px-8">{footer}</div>}
        </motion.div>
      </div>}
    </AnimatePresence>
  </Portal>;
}
