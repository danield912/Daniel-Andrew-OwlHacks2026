"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CalendarDays, ExternalLink, Map as MapIcon, MapPin, Route } from "lucide-react";
import { plansRequest, planTime, directionsUrl, canInvite, myMember, ROLE_INFO, type MemberStart, type SavedPlan } from "@/lib/saved-plans";
import { estimatedGameEnd, placeEmoji, stadiumArrival, viewerTrip } from "@/lib/game-day";
import { teamLook, tidyMatchup } from "@/lib/team-style";
import { SegmentedTabs } from "@/components/gp/tabs";
import { Scoreboard } from "@/components/gp/countdown";
import { Skeleton } from "@/components/gp/states";
import { PlansShell, PlansError, planTeam } from "./shared";
import { PlanMap } from "./plan-map";
import { InvitePanel } from "./invite-panel";
import { MembersList } from "./members-list";
import { PlanActions } from "./plan-actions";
import { GameDayStops } from "./game-day-stops";
import { ScheduleTimeline } from "./schedule-timeline";
import { MyStart } from "./my-start";
import { MemberCard } from "./member-card";
import { LateBanner, LiveBar } from "./live-ui";
import { useLive } from "./use-live";

function clock(iso: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

// Five-beat summary of the day, with a progress line that fills as the day goes on.
function DayAtAGlance({ plan }: { plan: SavedPlan }) {
  const trip = viewerTrip(plan);
  const route = trip?.route ?? null;
  const firstBefore = plan.stops?.filter(stop => stop.slot === "before").sort((a, b) => a.time.localeCompare(b.time))[0];
  const firstAfter = plan.stops?.filter(stop => stop.slot === "after").sort((a, b) => a.time.localeCompare(b.time))[0];
  const team = planTeam(plan);
  const beats = [
    { label: "Leave", emoji: "🏠", time: route ? route.leaveByTime || route.departureTime : null, hint: trip ? trip.origin : "Add your start", href: trip ? undefined : "#my-start" },
    { label: "Arrive", emoji: "🏟️", time: stadiumArrival(plan), hint: plan.game.venue.name },
    { label: "Pregame", emoji: firstBefore ? placeEmoji(firstBefore.place?.category) : "🍻", time: firstBefore?.time ?? null, hint: firstBefore?.place?.name ?? "Add a spot", href: firstBefore ? undefined : "#stops" },
    { label: "Kickoff", emoji: teamLook(team).emoji, time: plan.game.startsAt, hint: team?.name ?? "Game time" },
    { label: "After", emoji: firstAfter ? placeEmoji(firstAfter.place?.category) : "🌙", time: firstAfter?.time ?? null, hint: firstAfter?.place?.name ?? "Add a spot", href: firstAfter ? undefined : "#stops" },
  ];

  const start = Date.parse(route?.leaveByTime || route?.departureTime || stadiumArrival(plan));
  const end = Date.parse(firstAfter?.time ?? estimatedGameEnd(plan));
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => setProgress(Math.min(1, Math.max(0, (Date.now() - start) / (end - start))));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [start, end]);

  return <section aria-labelledby="glance-heading" className="gp-panel overflow-hidden p-5 sm:p-6">
    <h2 id="glance-heading" className="gp-eyebrow">Your day at a glance</h2>
    <div className="relative mt-5">
      <div aria-hidden="true" className="absolute left-[10%] right-[10%] top-6 hidden h-1 rounded-full bg-white/[0.07] sm:block">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-mint-300 via-amber-300 to-rose-400" initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 1.2, ease: "easeOut" }} />
      </div>
      <ol className="relative grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-2">
        {beats.map((beat, index) => {
          const body = <>
            <motion.span
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1 + index * 0.07, type: "spring", stiffness: 400, damping: 15 }}
              className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl ring-1 ${beat.time ? "bg-night-800 ring-white/15" : "border border-dashed border-white/20 bg-transparent ring-transparent"}`}
              aria-hidden="true"
            >{beat.emoji}</motion.span>
            <span className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{beat.label}</span>
            <span className={`font-score text-xl font-bold tabular ${beat.time ? "text-white" : "text-slate-500"}`}>{beat.time ? clock(beat.time) : "—"}</span>
            <span className="max-w-full truncate text-xs text-slate-400">{beat.hint}</span>
          </>;
          return <li key={beat.label} className={index === 4 ? "col-span-2 sm:col-span-1" : undefined}>
            {beat.href
              ? <a href={beat.href} className="flex flex-col items-center rounded-2xl p-2 text-center transition hover:bg-white/[0.04]">{body}</a>
              : <div className="flex flex-col items-center p-2 text-center">{body}</div>}
          </li>;
        })}
      </ol>
    </div>
  </section>;
}

function DetailsLoading() {
  return <div role="status" className="space-y-6">
    <span className="sr-only">Opening plan…</span>
    <Skeleton className="h-56 w-full rounded-[32px]" />
    <Skeleton className="h-36 w-full rounded-3xl" />
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><Skeleton className="h-96 rounded-3xl" /><Skeleton className="h-64 rounded-3xl" /></div>
  </div>;
}

export function PlanDetails({ id }: { id: string }) {
  const [plan, setPlan] = useState<SavedPlan | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<"schedule" | "map">("schedule");
  const [welcome, setWelcome] = useState(false);
  const live = useLive(id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  function openMember(userId: string) {
    setSelectedId(userId);
    setCardOpen(true);
  }

  // Arriving from "Join plan": greet them and ask where they're coming from.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("welcome")) {
      setWelcome(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
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

  const team = plan ? planTeam(plan) : null;
  const look = teamLook(team);
  const trip = plan ? viewerTrip(plan) : null;
  const route = trip?.route ?? null;
  const me = plan ? myMember(plan) : null;

  function saveMyStart(start: MemberStart) {
    setWelcome(false);
    setPlan(current => current && {
      ...current,
      members: current.members?.map(member => member.isYou ? { ...member, start } : member),
    });
  }

  return <PlansShell>
    <Link href="/plans" className="group mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
      <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" aria-hidden="true" />My Plans
    </Link>

    {error ? <PlansError title="We couldn’t open this plan" message={error} retry={() => setAttempt(n => n + 1)} /> : !plan ? <DetailsLoading /> : <div className="space-y-6">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 16, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 18 }}
        style={{ transformPerspective: 1200 }}
        className="relative overflow-hidden rounded-[32px] border border-white/10 shadow-lift"
      >
        <div className="absolute inset-0" style={{ background: look.gradient }} aria-hidden="true" />
        <div className="gp-yardlines absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-night-950/80 via-night-950/40 to-transparent" aria-hidden="true" />
        <motion.span
          aria-hidden="true"
          initial={{ rotate: -40, scale: 0.5, opacity: 0 }}
          animate={{ rotate: -14, scale: 1, opacity: 0.3 }}
          transition={{ type: "spring", stiffness: 90, damping: 10, delay: 0.15 }}
          className="absolute -right-6 -top-10 text-[180px] leading-none sm:text-[240px]"
        >{look.emoji}</motion.span>
        <div className="relative flex flex-wrap items-end justify-between gap-6 p-6 sm:p-10">
          <div className="min-w-0 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur">
              {look.emoji} {team?.name ?? "Game day"} · {ROLE_INFO[plan.role].emoji} {ROLE_INFO[plan.role].label}
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight text-white sm:text-5xl">{tidyMatchup(plan.game.name)}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-white/85">
              <span className="flex items-center gap-2"><CalendarDays size={17} aria-hidden="true" />{planTime(plan.game.startsAt)}</span>
              <span className="flex items-center gap-2"><MapPin size={17} aria-hidden="true" />{plan.game.venue.name}</span>
            </div>
          </div>
          <div className="rounded-3xl bg-night-950/50 p-4 backdrop-blur-md">
            <Scoreboard startsAt={plan.game.startsAt} />
          </div>
        </div>
      </motion.section>

      <LateBanner live={live} onOpenMember={openMember} />

      {me && !me.start && <MyStart plan={plan} start={null} welcome={welcome} onSaved={saveMyStart} />}

      <DayAtAGlance plan={plan} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section className="gp-panel p-5 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <SegmentedTabs<"schedule" | "map">
                label="Plan view"
                value={view}
                onChange={setView}
                options={[
                  { value: "schedule", label: "Schedule", icon: <Route size={16} aria-hidden="true" /> },
                  { value: "map", label: "Map", icon: <MapIcon size={16} aria-hidden="true" /> },
                ]}
              />
              <a
                href={directionsUrl(trip?.origin ?? "", `${plan.game.venue.name}, ${plan.game.venue.address}`, trip?.travelMode ?? plan.travelMode)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-mint-200 transition hover:bg-white/[0.06] hover:text-white"
              >Directions <ExternalLink size={14} aria-hidden="true" /></a>
            </div>

            <div className="mt-5"><LiveBar live={live} /></div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {view === "map" ? <div className="mt-6"><PlanMap venue={plan.game.venue} stops={plan.stops} crew={plan.members} liveLocations={live.locations} alerts={live.latestAlert} now={live.now} onSelect={openMember} /></div> : <>
                  <ScheduleTimeline plan={plan} />
                  {!route && <p className="mt-2 text-sm text-slate-400">This plan doesn’t have a saved route. Use Directions for current travel times.</p>}
                  {route?.warnings.map((warning, index) => <p key={index} className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-4 text-sm text-amber-100">{warning}</p>)}
                  {route && <p className="mt-4 text-xs text-slate-500">Your route is saved from when you added your start. Times are saved estimates or schedules, not live ETAs. Route data from Google.</p>}
                </>}
              </motion.div>
            </AnimatePresence>
          </section>

          <GameDayStops
            plan={plan}
            onStopsChange={stops => setPlan(current => current && { ...current, stops })}
            onSuggestionsChange={suggestions => setPlan(current => current && { ...current, suggestions })}
          />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          {me?.start && <MyStart key={me.start.origin} plan={plan} start={me.start} onSaved={saveMyStart} />}
          {canInvite(plan.role) && <InvitePanel planId={plan.id} />}
          <MembersList
            planId={plan.id}
            members={plan.members}
            viewerRole={plan.role}
            onChange={members => setPlan(current => current && { ...current, members })}
            onSelect={openMember}
          />
          <section className="gp-panel p-5 sm:p-6" aria-labelledby="prefs-heading">
            <h2 id="prefs-heading" className="font-display text-lg font-bold text-white">Plan settings</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {[
                { label: "Arrive by", value: `🏟️ ${planTime(plan.targetArrivalTime).replace(/^.*?, /, "")}` },
                { label: "Pregame", value: plan.preferences.pregame === "Food" ? "🍔 Food" : plan.preferences.pregame === "Bar / hangout" ? "🍺 Bar or tailgate" : "🏟️ Straight in" },
                { label: "Budget", value: plan.preferences.budget.split(" ")[0] },
                { label: "Crew", value: `👥 ${plan.members?.length ?? 1} ${plan.members?.length === 1 ? "person" : "people"}` },
              ].map(item => <div key={item.label} className="min-w-0 rounded-2xl bg-white/[0.03] p-3">
                <dt className="text-xs text-slate-400">{item.label}</dt>
                <dd className="mt-0.5 truncate font-semibold text-white" title={item.value}>{item.value}</dd>
              </div>)}
            </dl>
          </section>
          <PlanActions planId={plan.id} role={plan.role} />
        </aside>
      </div>

      <MemberCard
        plan={plan}
        member={plan.members?.find(member => member.userId === selectedId) ?? null}
        live={live}
        open={cardOpen}
        onClose={() => setCardOpen(false)}
      />
    </div>}
  </PlansShell>;
}
