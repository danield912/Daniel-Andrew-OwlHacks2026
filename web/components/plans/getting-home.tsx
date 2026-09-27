"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Home, RefreshCw } from "lucide-react";
import { directionsUrl, myMember, planTime, type SavedPlan } from "@/lib/saved-plans";
import { estimatedGameEnd } from "@/lib/game-day";
import { stepEmoji } from "@/lib/route-steps";
import { Button } from "@/components/gp/button";
import { InlineAlert, Skeleton } from "@/components/gp/states";
import { TransitStatus } from "./transit-status";

type HomeResult = {
  from: { name: string; kind: "stop" | "stadium" };
  to: { name: string };
  travelMode: "TRANSIT" | "DRIVE";
  plannedLeaveAt: string;
  route: {
    leaveAt: string;
    firstRideAt: string | null;
    firstRideFrom: string | null;
    arrivalTime: string;
    durationMinutes: number;
    steps: string[];
    lines: string[];
  } | null;
  warnings: string[];
};

const clock = (iso: string) => planTime(iso).replace(/^.*?, /, "");

// "How do I get home after the game?" Calculated on request (one Google
// Routes call) from the stadium or your last after-game stop.
export function GettingHome({ plan }: { plan: SavedPlan }) {
  const me = myMember(plan);
  const [result, setResult] = useState<HomeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const gameEnd = estimatedGameEnd(plan);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/plans/${encodeURIComponent(plan.id)}/home`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "We couldn’t plan your ride home.");
      setResult(data as HomeResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t plan your ride home.");
    } finally {
      setLoading(false);
    }
  }

  const route = result?.route ?? null;

  return <section aria-labelledby="home-heading" className="gp-panel p-5 sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="gp-eyebrow">After the final whistle</p>
        <h2 id="home-heading" className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-white sm:text-3xl"><Home size={24} className="text-mint-300" aria-hidden="true" />Getting home</h2>
        <p className="mt-1 text-sm text-slate-400">The game should end around {clock(gameEnd)}. We’ll plan your ride back{me?.start ? ` to ${me.start.origin}` : ""}.</p>
      </div>
      {result && <Button variant="ghost" size="sm" onClick={load} disabled={loading} icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />}>Refresh</Button>}
    </div>

    {!me?.start ? <p className="mt-5 rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-300">
      <a href="#my-start" className="font-semibold text-mint-200 underline">Add where you’re coming from</a> first, so we know where home is.
    </p>
    : !result && !loading ? <div className="mt-5">
      <Button size="lg" className="w-full sm:w-auto" onClick={load} icon={<Home size={18} aria-hidden="true" />}>Plan my ride home</Button>
      <p className="mt-2 text-xs text-slate-500">Uses the latest schedules, so it’s calculated when you ask.</p>
    </div>
    : loading && !result ? <div role="status" className="mt-5 space-y-3">
      <span className="sr-only">Planning your ride home…</span>
      <div className="grid grid-cols-3 gap-2">{[1, 2, 3].map(item => <Skeleton key={item} className="h-16" />)}</div>
      <Skeleton className="h-24" />
    </div> : null}

    {error && <InlineAlert tone="error" className="mt-4">{error}</InlineAlert>}

    <AnimatePresence>
      {result && <motion.div key={result.plannedLeaveAt + (route?.arrivalTime ?? "")} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">
        <p className="text-sm text-slate-300">
          From <span className="font-semibold text-white">{result.from.name}</span>{result.from.kind === "stop" ? " (your last stop)" : ""} to <span className="font-semibold text-white">{result.to.name}</span> · {result.travelMode === "TRANSIT" ? "🚇 SEPTA" : "🚗 Driving"}
        </p>

        {route && <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Head out", value: clock(route.leaveAt), tone: "text-mint-200" },
            { label: result.travelMode === "TRANSIT" ? "Next ride" : "Drive", value: result.travelMode === "TRANSIT" ? (route.firstRideAt ? clock(route.firstRideAt) : "Walk") : `${route.durationMinutes} min`, tone: "text-white" },
            { label: "Home by", value: clock(route.arrivalTime), tone: "text-white" },
          ].map((tile, index) => <motion.div key={tile.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{tile.label}</p>
            <p className={`font-score text-xl font-bold sm:text-2xl ${tile.tone}`}>{tile.value}</p>
          </motion.div>)}
        </div>}

        {result.warnings.map(warning => <InlineAlert key={warning} tone="warning">🌙 {warning}</InlineAlert>)}

        {route && route.steps.length > 0 && <ol className="space-y-2 rounded-2xl bg-white/[0.03] p-4">
          {route.steps.map((step, index) => <li key={index} className="flex items-start gap-3 text-sm text-slate-200">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.06] text-sm" aria-hidden="true">{stepEmoji(step, result.travelMode)}</span>
            <span className="min-w-0 pt-1">{step}</span>
          </li>)}
        </ol>}

        {route && route.lines.length > 0 && <TransitStatus lines={route.lines} title="SEPTA on your way home" />}

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={directionsUrl(`${result.from.name}, Philadelphia, PA`, result.to.name, result.travelMode)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white/[0.06] px-5 font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/10"
          >Directions home <ExternalLink size={15} aria-hidden="true" /></a>
          <p className="text-xs text-slate-500">Live route from Google, not saved. Times assume the game ends on schedule.</p>
        </div>
      </motion.div>}
    </AnimatePresence>
  </section>;
}
