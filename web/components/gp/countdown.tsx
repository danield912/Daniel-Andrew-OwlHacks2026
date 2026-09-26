"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

function partsUntil(target: number, now: number) {
  const ms = Math.max(0, target - now);
  return {
    done: ms === 0,
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    seconds: Math.floor(ms / 1000) % 60,
  };
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

// Short human countdown for badges: "Kickoff in 2h 15m", "In 3 days", "Live now".
export function countdownLabel(startsAt: string, now: number, endsAt?: string) {
  const start = Date.parse(startsAt);
  const end = endsAt ? Date.parse(endsAt) : start + 3 * 3_600_000;
  if (now >= end) return { text: "Final", tone: "past" as const };
  if (now >= start) return { text: "Live now", tone: "live" as const };
  const { days, hours, minutes } = partsUntil(start, now);
  if (days >= 2) return { text: `In ${days} days`, tone: "later" as const };
  if (days === 1) return { text: `Tomorrow · ${hours}h`, tone: "soon" as const };
  if (hours >= 1) return { text: `In ${hours}h ${minutes}m`, tone: "soon" as const };
  return { text: `In ${minutes} min`, tone: "soon" as const };
}

export function CountdownBadge({ startsAt, className }: { startsAt: string; className?: string }) {
  const now = useNow(30_000);
  if (now === null) return <span className={cn("inline-block h-6 w-20 rounded-full bg-white/5", className)} />;
  const { text, tone } = countdownLabel(startsAt, now);
  const tones = {
    live: "bg-rose-500/20 text-rose-200 ring-rose-400/40",
    soon: "bg-amber-300/15 text-amber-100 ring-amber-300/30",
    later: "bg-white/[0.06] text-slate-200 ring-white/10",
    past: "bg-white/[0.04] text-slate-400 ring-white/5",
  };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1", tones[tone], className)}>
    {tone === "live" && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-rose-400" /><span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" /></span>}
    {text}
  </span>;
}

function FlipDigit({ value }: { value: string }) {
  return <span className="relative inline-grid h-[1.15em] w-[0.62em] overflow-hidden [perspective:400px]">
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={value}
        initial={{ rotateX: -90, y: "-40%", opacity: 0 }}
        animate={{ rotateX: 0, y: "0%", opacity: 1 }}
        exit={{ rotateX: 90, y: "40%", opacity: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="col-start-1 row-start-1 block text-center [backface-visibility:hidden]"
      >{value}</motion.span>
    </AnimatePresence>
  </span>;
}

function Unit({ value, label }: { value: number; label: string }) {
  const text = String(value).padStart(2, "0");
  return <div className="flex flex-col items-center">
    <div className="rounded-2xl border border-white/10 bg-night-950/60 px-2.5 py-1.5 font-score text-4xl font-bold leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] tabular sm:text-5xl">
      {[...text].map((digit, index) => <FlipDigit key={index} value={digit} />)}
    </div>
    <span className="mt-1.5 font-score text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</span>
  </div>;
}

// Scoreboard-style countdown with flipping digits.
export function Scoreboard({ startsAt, label = "Kickoff in" }: { startsAt: string; label?: string }) {
  const now = useNow(1000);
  if (now === null) return <div className="h-[92px]" aria-hidden="true" />;
  const target = Date.parse(startsAt);
  const { done, days, hours, minutes, seconds } = partsUntil(target, now);
  if (done) {
    const status = countdownLabel(startsAt, now);
    return <div className="flex items-center gap-3">
      <CountdownBadge startsAt={startsAt} className="px-4 py-2 text-sm" />
      <span className="text-sm text-slate-300">{status.tone === "live" ? "Game in progress" : "This game has ended"}</span>
    </div>;
  }
  return <div role="timer" aria-label={`${label} ${days} days ${hours} hours ${minutes} minutes`}>
    <p className="gp-eyebrow mb-2 text-slate-300">{label}</p>
    <div className="flex items-start gap-2 sm:gap-3" aria-hidden="true">
      {days > 0 && <Unit value={days} label="Days" />}
      <Unit value={hours} label="Hrs" />
      <Unit value={minutes} label="Min" />
      {days === 0 && <Unit value={seconds} label="Sec" />}
    </div>
  </div>;
}
