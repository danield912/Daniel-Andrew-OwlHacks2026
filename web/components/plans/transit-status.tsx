"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";

type Level = "normal" | "info" | "detour" | "delays" | "alert" | "suspended" | "unknown";
type LineStatus = {
  line: string;
  name: string;
  mode: "subway" | "bus" | "trolley" | "rail";
  level: Level;
  headline: string;
  detail: string | null;
  checkedAt: string;
};

const LOOK: Record<Level, { chip: string; dot: string }> = {
  normal: { chip: "border-mint-300/25 bg-mint-300/[0.07] text-mint-100", dot: "bg-mint-300" },
  info: { chip: "border-sky-300/25 bg-sky-300/[0.07] text-sky-100", dot: "bg-sky-300" },
  detour: { chip: "border-amber-300/30 bg-amber-300/[0.08] text-amber-100", dot: "bg-amber-300" },
  delays: { chip: "border-amber-300/40 bg-amber-300/[0.1] text-amber-100", dot: "bg-amber-300" },
  alert: { chip: "border-rose-400/40 bg-rose-500/[0.1] text-rose-100", dot: "bg-rose-400" },
  suspended: { chip: "border-rose-400/50 bg-rose-500/[0.14] text-rose-100", dot: "bg-rose-400" },
  unknown: { chip: "border-white/10 bg-white/[0.03] text-slate-300", dot: "bg-slate-500" },
};

const MODE_EMOJI = { subway: "🚇", bus: "🚌", trolley: "🚋", rail: "🚆" };

// "Take B1 from Cecil B. Moore to NRG" -> "B1"
export function ridesOn(steps: string[] | undefined) {
  const lines: string[] = [];
  for (const step of steps ?? []) {
    const match = step.match(/^Take (.+?) from /i);
    if (match && !lines.includes(match[1].trim())) lines.push(match[1].trim());
  }
  return lines;
}

// Live SEPTA status for the lines on a route, as tappable pills.
export function TransitStatus({ lines, title = "SEPTA right now" }: { lines: string[]; title?: string }) {
  const [statuses, setStatuses] = useState<LineStatus[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const key = lines.join(",");

  useEffect(() => {
    if (!key) return;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/transit/status?lines=${encodeURIComponent(key)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) { setStatuses(data.lines); setFailed(false); }
      } catch {
        if (active) setFailed(true);
      }
    };
    load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, 120_000);
    return () => { active = false; clearInterval(timer); };
  }, [key]);

  if (!key) return null;
  const known = (statuses ?? []).filter(status => status.level !== "unknown");
  const trouble = known.find(status => ["delays", "alert", "suspended"].includes(status.level));

  return <div className="mt-4">
    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
      <span className="relative flex h-2 w-2" aria-hidden="true"><span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-mint-300" /><span className="relative inline-flex h-2 w-2 rounded-full bg-mint-300" /></span>
      {title}
    </p>
    {!statuses && !failed ? <div className="mt-2 flex gap-2" aria-hidden="true">
      {lines.map(line => <span key={line} className="h-8 w-40 animate-pulse rounded-full bg-white/[0.05]" />)}
    </div> : failed ? <p className="mt-2 text-sm text-slate-400">SEPTA status isn’t available right now.</p> : <>
      <ul className="mt-2 flex flex-wrap gap-2">
        {statuses!.map(status => {
          const expandable = Boolean(status.detail);
          const isOpen = open === status.line;
          return <li key={status.line} className="max-w-full">
            <button
              type="button"
              disabled={!expandable}
              aria-expanded={expandable ? isOpen : undefined}
              onClick={() => setOpen(isOpen ? null : status.line)}
              className={`flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-left text-sm transition ${LOOK[status.level].chip} ${expandable ? "hover:brightness-125" : "cursor-default"}`}
            >
              <span aria-hidden="true">{MODE_EMOJI[status.mode]}</span>
              <span className="font-bold">{status.line}</span>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${LOOK[status.level].dot}`} aria-hidden="true" />
              <span className="truncate">{status.headline}</span>
              {expandable && <motion.span animate={{ rotate: isOpen ? 180 : 0 }} className="shrink-0"><ChevronDown size={14} aria-hidden="true" /></motion.span>}
            </button>
          </li>;
        })}
      </ul>
      <AnimatePresence initial={false}>
        {open && statuses!.find(status => status.line === open)?.detail && <motion.p
          key={open}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-2 overflow-hidden rounded-2xl bg-white/[0.04] p-3 text-sm leading-relaxed text-slate-300"
        >{statuses!.find(status => status.line === open)!.detail}</motion.p>}
      </AnimatePresence>
      {trouble && <p className="mt-2 text-sm font-semibold text-amber-200">⏱️ {trouble.line}: {trouble.headline.toLowerCase()}. Leave a few minutes early.</p>}
    </>}
  </div>;
}
