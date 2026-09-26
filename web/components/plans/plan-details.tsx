"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { plansRequest, planTime, directionsUrl, type SavedPlan } from "@/lib/saved-plans";
import { PlansShell, PlansLoading, PlansError, panelClass, actionClass } from "./shared";
import { PlanMap } from "./plan-map";

export function PlanDetails({ id }: { id: string }) {
  const [plan, setPlan] = useState<SavedPlan | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<"map" | "schedule">("schedule");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    setPlan(null); setError("");
    plansRequest(`/api/plans/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(data => {
        if (!data.plan?.game || !data.plan?.route) throw new Error("The saved plan is incomplete.");
        if (active) setPlan(data.plan);
      })
      .catch(caught => { if (active) setError(controller.signal.aborted ? "Loading timed out. Please retry." : caught.message); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [id, attempt]);

  return <PlansShell>
    <Link href="/plans" className="inline-block text-sm text-teal-200 hover:underline">← My Plans</Link>
    {error ? <PlansError message={error} retry={() => setAttempt(n => n + 1)} /> : !plan ? <PlansLoading /> : <>
      <section className={panelClass}>
        <p className="text-sm font-semibold text-teal-200">{plan.role.replace("_", " ")} · {planTime(plan.game.startsAt)}</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{plan.title}</h1>
        <p className="mt-3 text-slate-300">{plan.game.name} · {plan.game.venue.name}</p>
        <p className="mt-3 text-sm text-slate-400">Route snapshot calculated {planTime(plan.routeCalculatedAt)}. Times are saved estimates or schedules, not live ETAs.</p>
      </section>
      <div aria-label="Plan view" className="flex gap-2">
        {(["map", "schedule"] as const).map(value => <button key={value} aria-pressed={view === value} onClick={() => setView(value)} className={`rounded-full px-6 py-3 font-semibold transition focus-visible:outline focus-visible:outline-teal-300 ${view === value ? "bg-teal-300 text-slate-950" : "bg-white/5 text-slate-300"}`}>{value === "map" ? "Map" : "Schedule"}</button>)}
      </div>
      <section className={panelClass}>
        {view === "map" ? <PlanMap venue={plan.game.venue} /> : <>
          <h2 className="text-2xl font-bold">Your game-day schedule</h2>
          <p className="mt-2 text-sm text-slate-400">Philadelphia time · {plan.travelMode === "TRANSIT" ? "Transit" : "Driving"} · {Math.ceil(plan.route.durationMinutes)} minutes of travel</p>
          <ol className="my-7 space-y-6 border-l border-teal-300/30 pl-6">
            <li><p className="font-semibold text-teal-200">{planTime(plan.route.leaveByTime || plan.route.departureTime)} — Leave by</p><p className="mt-1 text-slate-300">{plan.origin}</p></li>
            {plan.route.steps.map((step, index) => <li key={index} className="text-sm text-slate-300">{step}</li>)}
            <li><p className="font-semibold text-teal-200">{planTime(plan.route.arrivalTime)} — Stadium arrival</p><p className="mt-1 text-slate-300">{plan.game.venue.name}</p></li>
            <li className="font-semibold text-amber-200">{planTime(plan.game.startsAt)} — Game starts</li>
          </ol>
          {plan.route.warnings.map((warning, index) => <p key={index} className="mb-3 rounded-xl bg-amber-200/10 p-4 text-sm text-amber-100">{warning}</p>)}
          <div className="mb-5 rounded-xl bg-white/5 p-4 text-sm text-slate-300"><p>Pregame preference: {plan.pregame} · Budget: {plan.budget}</p><p className="mt-2">No before- or after-game stops have been booked or added yet.</p></div>
          <a className={actionClass} href={directionsUrl(plan.origin, `${plan.game.venue.name}, ${plan.game.venue.address}`, plan.travelMode)} target="_blank" rel="noopener noreferrer">Open directions ↗</a>
          <p className="mt-3 text-xs text-slate-400">Check the date and time in Google Maps; its route may differ. Route information powered by Google.</p>
        </>}
      </section>
    </>}
  </PlansShell>;
}
