"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { ArrowUpRight, CalendarDays, MapPin, Plus, Search, Users } from "lucide-react";
import { plansRequest, planTime, ROLE_INFO, type SavedPlan } from "@/lib/saved-plans";
import { teamLook, tidyMatchup } from "@/lib/team-style";
import { PageHeader } from "@/components/gp/app-shell";
import { ButtonLink } from "@/components/gp/button";
import { TiltCard } from "@/components/gp/surfaces";
import { SegmentedTabs } from "@/components/gp/tabs";
import { EmptyState } from "@/components/gp/states";
import { AnimatedNumber } from "@/components/gp/animated-number";
import { CountdownBadge } from "@/components/gp/countdown";
import { staggerChild, staggerParent } from "@/components/gp/reveal";
import { useToast } from "@/components/gp/toast";
import { PlansError, PlansLoading, PlansShell, planTeam } from "./shared";

type Tab = "created" | "joined";

function isPast(plan: SavedPlan) {
  return Date.parse(plan.game.startsAt) + 4 * 3_600_000 < Date.now();
}

function PlanCard({ plan }: { plan: SavedPlan }) {
  const team = planTeam(plan);
  const look = teamLook(team);
  const past = isPast(plan);
  return <motion.li variants={staggerChild} layout className="list-none">
    <Link href={`/plans/${encodeURIComponent(plan.id)}`} className="block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mint-300/40">
      <TiltCard glow={look.glow} className={`flex flex-col overflow-hidden border border-white/[0.08] bg-night-800/70 shadow-lift ${past ? "opacity-60 saturate-50" : ""}`}>
        <div className="relative h-24 overflow-hidden" style={{ background: look.gradient }}>
          <div className="gp-yardlines absolute inset-0 opacity-60" aria-hidden="true" />
          <span className="absolute -right-3 -top-5 text-[96px] leading-none opacity-25 transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110" aria-hidden="true">{look.emoji}</span>
          <div className="relative flex items-start justify-between gap-2 p-4" style={{ transform: "translateZ(30px)" }}>
            <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur">{ROLE_INFO[plan.role].emoji} {ROLE_INFO[plan.role].label}</span>
            <CountdownBadge startsAt={plan.game.startsAt} className="bg-black/30 text-white ring-white/20" />
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5" style={{ transform: "translateZ(18px)" }}>
          <h2 className="font-display text-lg font-bold leading-snug text-white">{tidyMatchup(plan.game.name)}</h2>
          <div className="mb-5 mt-3 space-y-1.5 text-sm text-slate-300">
            <p className="flex items-center gap-2"><CalendarDays size={15} className="text-slate-500" aria-hidden="true" />{planTime(plan.game.startsAt)}</p>
            <p className="flex items-center gap-2"><MapPin size={15} className="text-slate-500" aria-hidden="true" />{plan.game.venue.name}</p>
            {plan.stops && plan.stops.length > 0 && <p className="flex items-center gap-2 text-amber-200/90"><span aria-hidden="true">🍻</span>{plan.stops.length} {plan.stops.length === 1 ? "stop" : "stops"} planned</p>}
          </div>
          <span className="mt-auto flex items-center gap-1.5 font-semibold text-mint-300 transition-transform group-hover:translate-x-1">Open plan <ArrowUpRight size={17} aria-hidden="true" /></span>
        </div>
      </TiltCard>
    </Link>
  </motion.li>;
}

export function PlansList() {
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [tab, setTab] = useState<Tab>("created");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  // Confirmation after deleting or leaving a plan, then tidy the URL.
  const notice = params.get("notice");
  useEffect(() => {
    if (notice === "deleted") toast.success("Plan deleted");
    if (notice === "left") toast.success("You left the plan");
    if (notice) router.replace("/plans");
  }, [notice, toast, router]);

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
      .catch(caught => { if (active) setError(controller.signal.aborted ? "Loading timed out. Please retry." : caught.message); })
      .finally(() => { clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [attempt]);

  const created = plans.filter(plan => plan.role === "leader");
  const joined = plans.filter(plan => plan.role !== "leader");
  const upcoming = plans.filter(plan => !isPast(plan));
  const nextPlan = [...upcoming].sort((a, b) => Date.parse(a.game.startsAt) - Date.parse(b.game.startsAt))[0];

  const shown = useMemo(() => (tab === "created" ? created : joined)
    .filter(plan => `${plan.title} ${plan.game.name} ${plan.game.venue.name}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(isPast(a)) - Number(isPast(b)) || Date.parse(a.game.startsAt) - Date.parse(b.game.startsAt)),
  [tab, created, joined, query]);

  return <PlansShell>
    <PageHeader
      eyebrow="Your game days"
      title="My Plans"
      subtitle="Every outing you’ve planned or joined, with countdowns to kickoff."
      action={<ButtonLink href="/#games" icon={<Plus size={18} aria-hidden="true" />}>Plan a game</ButtonLink>}
    />

    {!error && <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        { label: "Upcoming", value: upcoming.length, emoji: "📅" },
        { label: "Created by me", value: created.length, emoji: "⭐" },
        { label: "Joined", value: joined.length, emoji: "🙌" },
      ].map((stat, index) => <motion.div
        key={stat.label}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06 }}
        className="gp-glass rounded-3xl p-5"
      >
        <p className="flex items-center gap-2 text-sm text-slate-400"><span aria-hidden="true">{stat.emoji}</span>{stat.label}</p>
        <p className="mt-2 font-score text-4xl font-bold text-white tabular">{loading ? "—" : <AnimatedNumber value={stat.value} />}</p>
      </motion.div>)}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="gp-glass col-span-2 rounded-3xl p-5 lg:col-span-1">
        <p className="flex items-center gap-2 text-sm text-slate-400"><span aria-hidden="true">⏱️</span>Next kickoff</p>
        {nextPlan ? <Link href={`/plans/${encodeURIComponent(nextPlan.id)}`} className="mt-2 block">
          <span className="block truncate font-semibold text-white">{tidyMatchup(nextPlan.game.name)}</span>
          <CountdownBadge startsAt={nextPlan.game.startsAt} className="mt-1.5" />
        </Link> : <p className="mt-2 font-semibold text-slate-300">{loading ? "—" : "Nothing scheduled"}</p>}
      </motion.div>
    </div>}

    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <SegmentedTabs<Tab>
        label="Plan category"
        value={tab}
        onChange={setTab}
        options={[
          { value: "created", label: "Created by me", icon: <span aria-hidden="true">⭐</span>, count: loading ? undefined : created.length },
          { value: "joined", label: "Joined", icon: <Users size={16} aria-hidden="true" />, count: loading ? undefined : joined.length },
        ]}
      />
      <div className="relative w-full sm:max-w-xs">
        <label htmlFor="plan-search" className="sr-only">Search plans</label>
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input id="plan-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your plans" className="gp-input pl-11" />
      </div>
    </div>

    {loading ? <PlansLoading /> : error ? <PlansError message={error} retry={() => setAttempt(n => n + 1)} /> : shown.length === 0 ? (
      query ? <EmptyState emoji="🔎" title="No plans match that" body="Try a different team, opponent, or venue." /> :
      tab === "created" ? <EmptyState
        emoji="🎟️"
        title="Your next outing starts here"
        body="Pick a game, get your route, and save it. Your plans show up here with a countdown to kickoff."
        action={<ButtonLink href="/#games" icon={<Plus size={18} aria-hidden="true" />}>Plan a game</ButtonLink>}
      /> : <EmptyState
        emoji="🙌"
        title="No joined plans yet"
        body="When a friend sends you their invite link, the plan you join shows up here."
      />
    ) : <motion.ul key={`${tab}-${query}`} variants={staggerParent} initial="hidden" animate="shown" className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {shown.map(plan => <PlanCard key={plan.id} plan={plan} />)}
    </motion.ul>}
  </PlansShell>;
}
