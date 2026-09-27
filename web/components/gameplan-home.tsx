"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowRight, CalendarHeart, Search, X } from "lucide-react";
import { TEAMS, TEAM_ORDER, cleanOpponent, tidyMatchup, type TeamKey } from "@/lib/team-style";
import { AppShell } from "@/components/gp/app-shell";
import { ButtonLink, Button } from "@/components/gp/button";
import { Stadium3D } from "@/components/gp/stadium-3d";
import { FilterChips } from "@/components/gp/tabs";
import { EmptyState, ErrorState, SkeletonCards } from "@/components/gp/states";
import { AnimatedNumber } from "@/components/gp/animated-number";
import { CountdownBadge } from "@/components/gp/countdown";
import { Reveal, staggerParent } from "@/components/gp/reveal";
import { useUser } from "@/components/gp/user";
import { GameCard } from "@/components/home/game-card";
import { PlanSheet } from "@/components/home/plan-sheet";
import { formatGameTime, type Game } from "@/components/home/types";

type ApiGame = {
  id: string;
  team: TeamKey;
  homeTeam: string;
  opponent: string;
  startsAt: string;
  venue: { name: string };
  ticketUrl?: string;
};

type TeamFilter = "all" | TeamKey;

const STEPS = [
  { emoji: "🎟️", title: "Pick your game", body: "Eagles, Phillies, Sixers, or Temple. Every upcoming home game in one place." },
  { emoji: "🗺️", title: "Plan the whole day", body: "When to leave, the SEPTA or driving route, and bars or food near the stadium." },
  { emoji: "🙌", title: "Bring your crew", body: "Share one link. Everyone sees the same plan, stops, and schedule." },
];

export function GamePlanHome() {
  const params = useSearchParams();
  const { status, name } = useUser();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [team, setTeam] = useState<TeamFilter>("all");
  const [sheetGame, setSheetGame] = useState<Game | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => { setQuery(params.get("q") ?? ""); }, [params]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadGames() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/games", { signal: controller.signal });
        if (response.redirected || !response.headers.get("content-type")?.includes("application/json")) {
          throw new Error("Please sign in to load upcoming games.");
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "We couldn’t load the games.");
        if (!Array.isArray(data.games)) throw new Error("The games response was unexpected. Please try again.");
        const upcoming: Game[] = (data.games as ApiGame[])
          .filter(game => game.team in TEAMS)
          .map(game => ({
            id: game.id,
            name: tidyMatchup(game.opponent ? `${game.homeTeam} vs. ${game.opponent}` : game.homeTeam),
            ...cleanOpponent(game.opponent ?? ""),
            team: game.team,
            startTime: Number.isFinite(Date.parse(game.startsAt)) ? game.startsAt : null,
            venue: game.venue.name,
            ticketUrl: typeof game.ticketUrl === "string" && game.ticketUrl.startsWith("https://") ? game.ticketUrl : undefined,
          }));
        upcoming.sort((a, b) => (a.startTime ? Date.parse(a.startTime) : Infinity) - (b.startTime ? Date.parse(b.startTime) : Infinity));
        setGames(upcoming);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadGames();
    return () => controller.abort();
  }, [attempt]);

  const visibleGames = useMemo(() => games.filter(game =>
    (team === "all" || game.team === team) &&
    `${game.name} ${game.venue} ${TEAMS[game.team].name}`.toLowerCase().includes(query.trim().toLowerCase()),
  ), [games, team, query]);

  const counts = useMemo(() => Object.fromEntries(TEAM_ORDER.map(key => [key, games.filter(game => game.team === key).length])) as Record<TeamKey, number>, [games]);
  const nextGame = games.find(game => game.startTime && Date.parse(game.startTime) > Date.now()) ?? null;

  function openPlan(game: Game) {
    setSheetGame(game);
    setSheetOpen(true);
  }

  return <AppShell>
    {/* Hero */}
    <section className="relative grid items-center gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="relative z-10">
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="gp-eyebrow">
          {status === "signed-in" && name ? `Welcome back, ${name.split(" ")[0]} 👋` : "Your city · Your crew · Your game"}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl"
        >
          Great game.<br /><span className="gp-gradient-text">Even better day.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mt-5 max-w-lg text-lg leading-relaxed text-slate-300">
          Plan your whole Philly game day: when to leave, how to get there, where to pregame, and where to go after. Then bring your crew.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="#games" size="lg" iconRight={<ArrowDown size={18} aria-hidden="true" />}>Find a game</ButtonLink>
          <ButtonLink href="/plans" size="lg" variant="secondary" icon={<CalendarHeart size={18} aria-hidden="true" />}>My plans</ButtonLink>
        </motion.div>

        <motion.dl initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-10 grid grid-cols-3 gap-4 sm:flex sm:flex-wrap sm:gap-x-10">
          {[
            { value: loading ? null : games.length, label: "Home games ahead" },
            { value: 4, label: "Philly teams" },
            { value: 3, label: "Stadiums covered" },
          ].map(stat => <div key={stat.label}>
            <dd className="font-score text-4xl font-bold text-white tabular">{stat.value === null ? "—" : <AnimatedNumber value={stat.value} />}</dd>
            <dt className="text-sm text-slate-400">{stat.label}</dt>
          </div>)}
        </motion.dl>
      </div>

      <div className="relative -mx-4 sm:mx-0">
        <Stadium3D />
        {/* Next up card floating over the field */}
        <AnimatePresence>
          {nextGame && <motion.button
            type="button"
            onClick={() => openPlan(nextGame)}
            initial={{ opacity: 0, y: 30, rotateX: 20 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 160, damping: 18 }}
            whileHover={{ y: -4, scale: 1.02 }}
            className="absolute bottom-2 left-4 right-4 flex items-center gap-4 rounded-3xl border border-white/10 bg-night-800/80 p-4 text-left shadow-lift backdrop-blur-xl sm:left-auto sm:right-6 sm:w-80"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: TEAMS[nextGame.team].gradient }} aria-hidden="true">{TEAMS[nextGame.team].emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-mint-300">Next up</span>
                {nextGame.startTime && <CountdownBadge startsAt={nextGame.startTime} className="px-2 py-0.5" />}
              </span>
              <span className="mt-0.5 block truncate font-semibold text-white">{TEAMS[nextGame.team].name} vs. {nextGame.opponent || "TBA"}</span>
              <span className="block truncate text-sm text-slate-400">{formatGameTime(nextGame.startTime, true)}</span>
            </span>
            <ArrowRight size={18} className="shrink-0 text-mint-300" aria-hidden="true" />
          </motion.button>}
        </AnimatePresence>
      </div>
    </section>

    {/* How it works */}
    <section aria-labelledby="how-heading" className="mt-16 sm:mt-24">
      <Reveal><h2 id="how-heading" className="gp-eyebrow">How it works</h2></Reveal>
      <ol className="mt-5 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => <Reveal as="li" key={step.title} delay={index * 0.08} className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 transition-colors hover:border-mint-300/30">
          <div className="flex items-center gap-3">
            <span className="font-score text-5xl font-bold text-white/10 transition-colors group-hover:text-mint-300/40">{index + 1}</span>
            <motion.span whileHover={{ rotate: [0, -12, 12, 0], scale: 1.15 }} className="text-3xl" aria-hidden="true">{step.emoji}</motion.span>
          </div>
          <h3 className="mt-3 font-display text-xl font-bold text-white">{step.title}</h3>
          <p className="mt-2 text-slate-400">{step.body}</p>
        </Reveal>)}
      </ol>
    </section>

    {/* Games */}
    <section id="games" aria-labelledby="games-heading" className="mt-16 scroll-mt-24 sm:mt-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="gp-eyebrow">Upcoming home games</p>
          <h2 id="games-heading" className="mt-2 font-display text-3xl font-extrabold text-white sm:text-4xl">Find your next game</h2>
          <p className="mt-1 text-sm text-slate-400">All times in Philadelphia time</p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor="game-search" className="sr-only">Search games or venues</label>
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            id="game-search"
            type="search"
            placeholder="Search opponent or venue"
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="gp-input pl-11 pr-10"
          />
          <AnimatePresence>
            {query && <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            ><X size={16} aria-hidden="true" /></motion.button>}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-6">
        <FilterChips<TeamFilter>
          label="Filter by team"
          value={team}
          onChange={setTeam}
          options={[
            { value: "all", label: <>🏟️ All teams{!loading && <span className="opacity-70">· {games.length}</span>}</> },
            ...TEAM_ORDER.map(key => ({
              value: key as TeamFilter,
              label: <>{TEAMS[key].emoji} {TEAMS[key].name}{!loading && <span className="opacity-70">· {counts[key]}</span>}</>,
              accent: TEAMS[key].gradient,
            })),
          ]}
        />
      </div>

      <div className="mt-6">
        {loading ? <SkeletonCards count={6} label="Loading games…" /> : error ? <ErrorState
          title="We couldn’t load the games"
          message={error}
          onRetry={() => setAttempt(value => value + 1)}
          extra={status !== "signed-in" && <ButtonLink href="/auth/login" variant="ghost" size="sm">Sign in</ButtonLink>}
        /> : visibleGames.length === 0 ? <EmptyState
          emoji={team === "all" ? "🔎" : TEAMS[team].emoji}
          title={games.length === 0 ? "No home games listed right now" : "No games match that"}
          body={games.length === 0 ? "Check back soon. New games appear as soon as tickets go on sale." : "Try another team or clear your search."}
          action={games.length > 0 && <Button variant="secondary" onClick={() => { setQuery(""); setTeam("all"); }}>Show all games</Button>}
        /> : <motion.ul
          key={`${team}-${query}`}
          variants={staggerParent}
          initial="hidden"
          animate="shown"
          className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          {visibleGames.map(game => <GameCard key={game.id} game={game} onPlan={openPlan} />)}
        </motion.ul>}
      </div>
    </section>

    <PlanSheet key={sheetGame?.id ?? "none"} game={sheetGame} open={sheetOpen} onClose={() => setSheetOpen(false)} />
  </AppShell>;
}
