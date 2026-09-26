"use client";
import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export type Choice<T extends string> = { value: T; label: string; hint?: string; icon: ReactNode };

// Tap-to-pick option cards: one click instead of opening a dropdown.
export function ChoiceGroup<T extends string>({ label, value, onChange, options, disabled, columns = 3 }: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Choice<T>[];
  disabled?: boolean;
  columns?: 2 | 3;
}) {
  const id = useId();
  return <fieldset disabled={disabled} className="min-w-0">
    <legend className="gp-label">{label}</legend>
    <div role="radiogroup" className={cn("grid gap-2", columns === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {options.map(option => {
        const active = option.value === value;
        return <motion.button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(option.value)}
          whileHover={disabled ? undefined : { y: -2 }}
          whileTap={disabled ? undefined : { scale: 0.96 }}
          className={cn(
            "relative flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 text-center transition-colors disabled:opacity-60",
            active ? "border-mint-300/70 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25",
          )}
        >
          {active && <motion.span
            layoutId={`choice-${id}`}
            className="absolute inset-0 rounded-2xl bg-mint-300/[0.12] shadow-glow-sm"
            transition={{ type: "spring", stiffness: 480, damping: 34 }}
          />}
          <span className="relative text-xl leading-none">{option.icon}</span>
          <span className="relative text-sm font-semibold leading-tight">{option.label}</span>
          {option.hint && <span className="relative text-[11px] leading-tight text-slate-400">{option.hint}</span>}
        </motion.button>;
      })}
    </div>
  </fieldset>;
}
