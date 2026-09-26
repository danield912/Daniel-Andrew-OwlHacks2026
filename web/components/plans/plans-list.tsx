"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, ArrowUpRight } from "lucide-react";
import { plansRequest, planTime, type SavedPlan } from "@/lib/saved-plans";
import { PlansShell, PlansLoading, PlansError, panelClass, actionClass } from "./shared";

export function PlansList() {
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [tab, setTab] = useState<"created" | "joined">("created");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 15000);
    setLoading(true);
    setError("");
    plansRequest("/api/plans", { signal: controller.signal })
      .then(data => {
        if (!Array.isArray(data.plans)) throw new Error("Unexpected plans response.");
        if (active) setPlans(data.plans);
      })
      .catch(caught => {
        if (active) setError(controller.signal.aborted ? "Loading timed out. Please retry." : caught.message);
      })
      .finally(() => { clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [attempt]);

  const filtered = plans.filter(plan => tab === "created" ? plan.role === "leader" : plan.role !== "leader");
  return <PlansShell>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-teal-200">Your next great day out</p><h1 className="mt-2 text-4xl font-bold">My Plans</h1><p className="mt-3 text-slate-400">Your games, your people, all in one place.</p></div>
      <Link href="/" className={actionClass}>Plan a game</Link>
    </div>
    <div aria-label="Plan category" className="flex flex-wrap gap-2">
      {(["created", "joined"] as const).map(value => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)} className={`rounded-full px-5 py-3 font-medium transition focus-visible:outline focus-visible:outline-teal-300 ${tab === value ? "bg-teal-300 text-slate-950" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>
        {value === "created" ? "Created by me" : "Joined"}
      </button>)}
    </div>
    {loading ? <PlansLoading /> : error ? <PlansError message={error} retry={() => setAttempt(n => n + 1)} /> : filtered.length === 0 ? <section className={`${panelClass} text-center`}>
      <h2 className="text-xl font-semibold">{tab === "created" ? "Your next outing starts here" : "No joined plans yet"}</h2>
      <p className="my-4 text-slate-400">{tab === "created" ? "Choose a game, calculate your trip, then save your plan." : "Plans you join will appear here. Invitations are coming in the next step."}</p>
      <Link href="/" className={actionClass}>Explore games</Link>
    </section> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {filtered.map(plan => <Link href={`/plans/${encodeURIComponent(plan.id)}`} key={plan.id} className={`${panelClass} block transition motion-safe:hover:-translate-y-1 hover:border-teal-300/40 focus-visible:outline focus-visible:outline-teal-300`}>
        <span className="rounded-full bg-teal-300/10 px-3 py-1 text-xs font-semibold text-teal-200">{plan.role.replace("_", " ")}</span>
        <h2 className="mt-5 text-xl font-bold">{plan.title}</h2>
        <p className="mt-2 text-sm text-slate-300">{plan.game.name}</p>
        <p className="mt-5 flex items-center gap-2 text-sm"><CalendarDays size={16} aria-hidden="true" />{planTime(plan.game.startsAt)}</p>
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-300"><MapPin size={16} aria-hidden="true" />{plan.game.venue.name}</p>
        <p className="mt-6 flex items-center gap-2 font-semibold text-teal-200">Open plan <ArrowUpRight size={17} aria-hidden="true" /></p>
      </Link>)}
    </div>}
    <p className="text-xs text-slate-400">All times shown in Philadelphia time.</p>
  </PlansShell>;
}
