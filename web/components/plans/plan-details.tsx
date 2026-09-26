"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { plansRequest, planTime, directionsUrl, canInvite, roleLabels, type SavedPlan } from "@/lib/saved-plans";
import { PlansShell, PlansLoading, PlansError, panelClass, actionClass } from "./shared";
import { PlanMap } from "./plan-map";
import { InvitePanel } from "./invite-panel";
import { MembersList } from "./members-list";
import { PlanActions } from "./plan-actions";
import { GameDayStops } from "./game-day-stops";
import { ScheduleTimeline } from "./schedule-timeline";

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
        if (!data.plan?.game) throw new Error("The saved plan is incomplete.");
        if (active) setPlan(data.plan);
      })
      .catch(caught => { if (active) setError(controller.signal.aborted ? "Loading timed out. Please retry." : caught.message); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [id, attempt]);

  const route = plan?.routeSnapshot;

  return <PlansShell>
    <Link href="/plans" className="inline-block text-sm text-teal-200 hover:underline">← My Plans</Link>
    {error ? <PlansError message={error} retry={() => setAttempt(n => n + 1)} /> : !plan ? <PlansLoading /> : <>
      <section className={panelClass}>
        <p className="text-sm font-semibold text-teal-200">{roleLabels[plan.role]} · {planTime(plan.game.startsAt)}</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{plan.title}</h1>
        <p className="mt-3 text-slate-300">{plan.game.name} · {plan.game.venue.name}</p>
        {plan.routeSnapshot && plan.routeCalculatedAt && <p className="mt-3 text-sm text-slate-400">Route snapshot calculated {planTime(plan.routeCalculatedAt)}. Times are saved estimates or schedules, not live ETAs.</p>}
      </section>
      <div aria-label="Plan view" className="flex gap-2">
        {(["map", "schedule"] as const).map(value => <button key={value} aria-pressed={view === value} onClick={() => setView(value)} className={`rounded-full px-6 py-3 font-semibold transition focus-visible:outline focus-visible:outline-teal-300 ${view === value ? "bg-teal-300 text-slate-950" : "bg-white/5 text-slate-300"}`}>{value === "map" ? "Map" : "Schedule"}</button>)}
      </div>
      <section className={panelClass}>
        {view === "map" ? <PlanMap venue={plan.game.venue} stops={plan.stops} /> : <>
          <h2 className="text-2xl font-bold">Your game-day schedule</h2>
          <p className="mt-2 text-sm text-slate-400">Philadelphia time · {plan.travelMode === "TRANSIT" ? "Transit" : "Driving"}{route ? ` · ${Math.ceil(route.durationMinutes)} minutes of travel` : ""}</p>
          <ScheduleTimeline plan={plan} />
          {!route && <p className="mb-5 text-sm text-slate-400">This plan doesn’t have a saved route. Use Open directions for current travel times.</p>}
          {route?.warnings.map((warning, index) => <p key={index} className="mb-3 rounded-xl bg-amber-200/10 p-4 text-sm text-amber-100">{warning}</p>)}
          <div className="mb-5 rounded-xl bg-white/5 p-4 text-sm text-slate-300"><p>Pregame preference: {plan.preferences.pregame} · Budget: {plan.preferences.budget}</p>{!plan.stops?.length && <p className="mt-2">No before- or after-game stops yet. Add some below.</p>}</div>
          <a className={actionClass} href={directionsUrl(plan.origin, `${plan.game.venue.name}, ${plan.game.venue.address}`, plan.travelMode)} target="_blank" rel="noopener noreferrer">Open directions ↗</a>
          <p className="mt-3 text-xs text-slate-400">Check the date and time in Google Maps; its route may differ. Route information powered by Google.</p>
        </>}
      </section>
      <GameDayStops plan={plan} onStopsChange={stops => setPlan(current => current && { ...current, stops })} />
      <div className="grid gap-6 lg:grid-cols-2">
        <MembersList members={plan.members} />
        {canInvite(plan.role) && <InvitePanel planId={plan.id} />}
      </div>
      <PlanActions planId={plan.id} role={plan.role} />
    </>}
  </PlansShell>;
}
