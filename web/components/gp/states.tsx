"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("relative overflow-hidden rounded-2xl bg-white/[0.05]", className)}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
  </div>;
}

export function SkeletonCards({ count = 3, className, label = "Loading…" }: { count?: number; className?: string; label?: string }) {
  return <div role="status">
    <span className="sr-only">{label}</span>
    <div className={cn("grid gap-5 md:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, index) => <div key={index} className="gp-glass rounded-3xl p-6">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="mt-5 h-7 w-4/5" />
        <Skeleton className="mt-3 h-4 w-3/5" />
        <Skeleton className="mt-8 h-11 w-full" />
      </div>)}
    </div>
  </div>;
}

export function EmptyState({ emoji, title, body, action, className }: {
  emoji: string;
  title: string;
  body: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn("relative overflow-hidden rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center", className)}
  >
    <motion.div
      aria-hidden="true"
      animate={{ y: [0, -8, 0], rotate: [0, -6, 6, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-white/[0.06] text-3xl"
    >{emoji}</motion.div>
    <h3 className="font-display text-xl font-bold text-white">{title}</h3>
    <p className="mx-auto mt-2 max-w-md text-slate-400">{body}</p>
    {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
  </motion.div>;
}

export function ErrorState({ title = "Something went wrong", message, onRetry, extra, className }: {
  title?: string;
  message: string;
  onRetry?: () => void;
  extra?: ReactNode;
  className?: string;
}) {
  return <motion.div
    role="alert"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn("rounded-3xl border border-amber-300/25 bg-gradient-to-br from-amber-400/[0.08] to-transparent p-6 sm:p-8", className)}
  >
    <div className="flex items-start gap-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-300/15 text-amber-200"><AlertTriangle size={22} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-lg font-bold text-amber-100">{title}</h3>
        <p className="mt-1 text-slate-300">{message}</p>
        {(onRetry || extra) && <div className="mt-5 flex flex-wrap items-center gap-3">
          {onRetry && <Button variant="secondary" size="sm" icon={<RotateCcw size={16} aria-hidden="true" />} onClick={onRetry}>Try again</Button>}
          {extra}
        </div>}
      </div>
    </div>
  </motion.div>;
}

export function InlineAlert({ tone = "warning", children, className }: { tone?: "warning" | "error" | "info"; children: ReactNode; className?: string }) {
  const tones = {
    warning: "border-amber-300/25 bg-amber-300/[0.07] text-amber-100",
    error: "border-rose-400/30 bg-rose-500/[0.08] text-rose-100",
    info: "border-sky-300/25 bg-sky-300/[0.07] text-sky-100",
  };
  return <motion.p
    role={tone === "info" ? "status" : "alert"}
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: "auto" }}
    className={cn("rounded-2xl border px-4 py-3 text-sm", tones[tone], className)}
  >{children}</motion.p>;
}
