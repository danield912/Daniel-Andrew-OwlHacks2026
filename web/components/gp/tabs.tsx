"use client";
import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export type TabOption<T extends string> = { value: T; label: ReactNode; icon?: ReactNode; count?: number; disabled?: boolean };

// Segmented control whose highlight slides between options.
export function SegmentedTabs<T extends string>({ value, onChange, options, label, size = "md", className, fill }: {
  value: T;
  onChange: (value: T) => void;
  options: TabOption<T>[];
  label: string;
  size?: "sm" | "md";
  className?: string;
  fill?: boolean;
}) {
  const id = useId();
  return <div role="tablist" aria-label={label} className={cn("gp-glass inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1 scrollbar-none", fill && "flex w-full", className)}>
    {options.map(option => {
      const active = option.value === value;
      return <button
        key={option.value}
        role="tab"
        type="button"
        aria-selected={active}
        disabled={option.disabled}
        onClick={() => onChange(option.value)}
        className={cn(
          "relative flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-[15px]",
          fill && "flex-1",
          active ? "text-night-950" : "text-slate-300 hover:text-white",
        )}
      >
        {active && <motion.span
          layoutId={`tab-pill-${id}`}
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-mint-300 to-glow-cyan shadow-glow-sm"
          transition={{ type: "spring", stiffness: 480, damping: 34 }}
        />}
        <span className="relative flex items-center gap-2">
          {option.icon}
          {option.label}
          {typeof option.count === "number" && <span className={cn("rounded-full px-1.5 text-xs tabular", active ? "bg-night-950/15" : "bg-white/10")}>{option.count}</span>}
        </span>
      </button>;
    })}
  </div>;
}

// Pill filter chips (multi-purpose, e.g. team filters). Active chip gets a sliding glow.
export function FilterChips<T extends string>({ value, onChange, options, label }: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; accent?: string }[];
  label: string;
}) {
  const id = useId();
  return <div role="group" aria-label={label} className="flex flex-wrap gap-2">
    {options.map(option => {
      const active = option.value === value;
      return <motion.button
        key={option.value}
        type="button"
        aria-pressed={active}
        onClick={() => onChange(option.value)}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "relative rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
          active ? "border-transparent text-night-950" : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25 hover:text-white",
        )}
      >
        {active && <motion.span
          layoutId={`chip-${id}`}
          className="absolute inset-0 rounded-full"
          style={{ background: option.accent ?? "linear-gradient(90deg,#5eead4,#22d3ee)" }}
          transition={{ type: "spring", stiffness: 480, damping: 34 }}
        />}
        <span className={cn("relative flex items-center gap-1.5", active && option.accent && "text-white")}>{option.label}</span>
      </motion.button>;
    })}
  </div>;
}
