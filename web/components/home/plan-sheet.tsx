"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Clock, ExternalLink, MapPin, Navigation, Route, Timer } from "lucide-react";
import { TEAMS } from "@/lib/team-style";
import { directionsUrl } from "@/lib/saved-plans";
import { phillyClockTime, phillyTimeOnGameDay } from "@/lib/philly-time";
import { Sheet } from "@/components/gp/modal";
import { Button } from "@/components/gp/button";
import { ChoiceGroup } from "@/components/gp/choice";
import { InlineAlert } from "@/components/gp/states";
import { AnimatedNumber } from "@/components/gp/animated-number";
import { useUser } from "@/components/gp/user";
import { SavePlanButton } from "@/components/plans/save-plan-button";
import { stepEmoji } from "@/lib/route-steps";
import { formatClock, formatGameTime, type Game, type PlanResult } from "./types";

// These exact strings are what the API and saved plans use.
const BUDGETS = ["$ — Budget-friendly", "$$ — Mid-range", "$$$ — Treat ourselves"] as const;
const PREGAMES = ["Food", "Bar / hangout", "Straight to the stadium"] as const;
type Transport = "Transit" | "Driving";
type Budget = (typeof BUDGETS)[number];
type Pregame = (typeof PREGAMES)[number];

const ARRIVE_PRESETS = [
  { minutes: 120, label: "2 hrs early" },
  { minutes: 60, label: "1 hr early" },
  { minutes: 45, label: "45 min early" },
];

function defaultLead(pregame: Pregame) {
  return pregame === "Straight to the stadium" ? 45 : 120;
}

function clockBefore(startTime: string, minutes: number) {
  return phillyClockTime(new Date(Date.parse(startTime) - minutes * 60_000).toISOString());
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

// Keep `game` set while closing so the panel can animate out; key the
// component by game id so each new game starts with a fresh form.
export function PlanSheet({ game, open, onClose }: { game: Game | null; open: boolean; onClose: () => void }) {
  const { defaults } = useUser();
  const team = game ? TEAMS[game.team] : null;

  const [origin, setOrigin] = useState(defaults.origin ?? "");
  const [transport, setTransport] = useState<Transport>(defaults.travelMode === "Driving" ? "Driving" : "Transit");
  const [budget, setBudget] = useState<Budget>(oneOf(defaults.budget, BUDGETS, "$$ — Mid-range"));
  const [pregame, setPregame] = useState<Pregame>(oneOf(defaults.pregame, PREGAMES, "Bar / hangout"));
  const [arriveBy, setArriveBy] = useState(game?.startTime ? clockBefore(game.startTime, defaultLead(pregame)) : "");
  const [arriveTouched, setArriveTouched] = useState(false);

  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState("");
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [routeCalculatedAt, setRouteCalculatedAt] = useState("");

  if (!game || !team) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;

  const arrivalTime = game.startTime && arriveBy ? phillyTimeOnGameDay(game.startTime, arriveBy) : null;
  let arrivalError = "";
  if (!game.startTime) arrivalError = "This game’s start time isn’t confirmed yet, so we can’t plan your arrival.";
  else if (!arrivalTime) arrivalError = "Choose when you want to arrive at the stadium.";
  else if (Date.parse(arrivalTime) > Date.parse(game.startTime)) arrivalError = `Pick a time at or before kickoff (${formatClock(game.startTime)}).`;
  else if (Date.parse(arrivalTime) <= Date.now()) arrivalError = "That time has already passed. Pick a later time.";

  const minutesEarly = arrivalTime && game.startTime ? Math.round((Date.parse(game.startTime) - Date.parse(arrivalTime)) / 60_000) : null;

  function changePregame(next: Pregame) {
    setPregame(next);
    if (!arriveTouched && game?.startTime) setArriveBy(clockBefore(game.startTime, defaultLead(next)));
    setPlanResult(null);
  }

  async function calculate(event: React.FormEvent) {
    event.preventDefault();
    if (!game || !origin.trim() || !arrivalTime || arrivalError) return;
    setPlanning(true);
    setPlanError("");
    setPlanResult(null);
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game.id,
          origin: origin.trim(),
          travelMode: transport === "Transit" ? "TRANSIT" : "DRIVE",
          targetArrivalTime: arrivalTime,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We couldn’t calculate your route.");
      if (data.status === "unavailable") {
        setPlanError(data.message || "No route is available for that arrival time.");
        return;
      }
      if (data.status !== "ok") throw new Error("The route response was unexpected. Please try again.");
      setRouteCalculatedAt(new Date().toISOString());
      setPlanResult(data as PlanResult);
    } catch (caught) {
      setPlanError(caught instanceof Error ? caught.message : "We couldn’t calculate your route. Please try again.");
    } finally {
      setPlanning(false);
    }
  }

  const header = <div className="relative h-16 overflow-hidden sm:h-32" style={{ background: team.gradient }}>
    <div className="gp-yardlines absolute inset-0 opacity-70" aria-hidden="true" />
    <motion.div
      aria-hidden="true"
      initial={{ rotate: -30, scale: 0.6, opacity: 0 }}
      animate={{ rotate: -12, scale: 1, opacity: 0.35 }}
      transition={{ type: "spring", stiffness: 120, damping: 12, delay: 0.1 }}
      className="absolute -right-2 -top-4 text-[120px] leading-none"
    >{team.emoji}</motion.div>
    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-night-850 to-transparent" />
  </div>;

  const subtitle = <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
    <span className="flex items-center gap-1.5"><Clock size={14} aria-hidden="true" />{formatGameTime(game.startTime, true)}</span>
    <span className="flex items-center gap-1.5"><MapPin size={14} aria-hidden="true" />{game.venue}</span>
    {game.ticketUrl && <a href={game.ticketUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-mint-200 hover:text-white">🎟️ Get tickets ↗</a>}
  </span>;

  const footer = !planResult ? <Button
    type="submit"
    form="plan-form"
    size="lg"
    className="w-full"
    loading={planning}
    loadingText="Finding your route…"
    disabled={Boolean(arrivalError) || !origin.trim()}
    iconRight={<ArrowRight size={18} aria-hidden="true" />}
  >View my trip</Button> : undefined;

  return <Sheet
    open={open}
    onClose={onClose}
    header={header}
    title={game.opponent ? `${team.name} vs. ${game.opponent}` : game.name}
    subtitle={subtitle}
    footer={footer}
  >
    <AnimatePresence mode="wait" initial={false}>
      {!planResult ? <motion.form
        key="form"
        id="plan-form"
        onSubmit={calculate}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        <div>
          <label htmlFor="origin" className="gp-label">Where are you starting?</label>
          <div className="relative">
            <Navigation size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mint-300" aria-hidden="true" />
            <input
              id="origin"
              required
              data-autofocus
              disabled={planning}
              maxLength={200}
              value={origin}
              onChange={event => { setOrigin(event.target.value); setPlanError(""); }}
              placeholder="Address, neighborhood, or campus"
              className="gp-input pl-11"
              autoComplete="street-address"
            />
          </div>
        </div>

        <ChoiceGroup<Transport>
          label="How are you getting there?"
          value={transport}
          onChange={setTransport}
          disabled={planning}
          columns={2}
          options={[
            { value: "Transit", label: "SEPTA", hint: "Train or bus", icon: "🚇" },
            { value: "Driving", label: "Driving", hint: "Car or rideshare", icon: "🚗" },
          ]}
        />

        <ChoiceGroup<Pregame>
          label="Before the game"
          value={pregame}
          onChange={changePregame}
          disabled={planning}
          options={[
            { value: "Food", label: "Grab food", icon: "🍔" },
            { value: "Bar / hangout", label: "Bar or tailgate", icon: "🍺" },
            { value: "Straight to the stadium", label: "Straight in", icon: "🏟️" },
          ]}
        />

        <ChoiceGroup<Budget>
          label="Food budget"
          value={budget}
          onChange={setBudget}
          disabled={planning}
          options={[
            { value: "$ — Budget-friendly", label: "$", hint: "Budget", icon: "🌭" },
            { value: "$$ — Mid-range", label: "$$", hint: "Mid-range", icon: "🍕" },
            { value: "$$$ — Treat ourselves", label: "$$$", hint: "Treat yourself", icon: "🥩" },
          ]}
        />

        <div>
          <label htmlFor="arrive-by" className="gp-label">Arrive at the stadium by</label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-40">
              <Timer size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mint-300" aria-hidden="true" />
              <input
                id="arrive-by"
                type="time"
                required
                step={300}
                disabled={planning || !game.startTime}
                value={arriveBy}
                onChange={event => { setArriveBy(event.target.value); setArriveTouched(true); }}
                aria-invalid={Boolean(arrivalError)}
                aria-describedby="arrive-by-hint"
                className="gp-input pl-11"
              />
            </div>
            {game.startTime && ARRIVE_PRESETS.map(preset => {
              const clock = clockBefore(game.startTime!, preset.minutes);
              const active = clock === arriveBy;
              return <motion.button
                key={preset.minutes}
                type="button"
                whileTap={{ scale: 0.94 }}
                disabled={planning}
                onClick={() => { setArriveBy(clock); setArriveTouched(true); }}
                className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${active ? "border-mint-300/60 bg-mint-300/15 text-mint-200" : "border-white/10 text-slate-300 hover:border-white/25 hover:text-white"}`}
              >{preset.label}</motion.button>;
            })}
          </div>
          <p id="arrive-by-hint" className={`mt-2 text-sm ${arrivalError ? "text-amber-200" : "text-slate-400"}`}>
            {arrivalError || (minutesEarly !== null && `Philadelphia time · ${minutesEarly >= 60 ? `${Math.floor(minutesEarly / 60)}h ${minutesEarly % 60 ? `${minutesEarly % 60}m ` : ""}` : `${minutesEarly} min `}before kickoff at ${formatClock(game.startTime)}${pregame !== "Straight to the stadium" ? " · time to pregame near the stadium 🍻" : ""}`)}
          </p>
        </div>

        <AnimatePresence>{planError && <InlineAlert tone="warning">{planError}</InlineAlert>}</AnimatePresence>
      </motion.form> : <motion.div
        key="result"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="space-y-6"
      >
        <button type="button" onClick={() => setPlanResult(null)} className="flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white">
          <ArrowLeft size={16} aria-hidden="true" />Edit trip
        </button>

        <div>
          <p className="gp-eyebrow">Your route is ready</p>
          <h3 className="mt-1 font-display text-2xl font-bold text-white">From {origin.trim()}</h3>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Leave by", value: formatClock(planResult.leaveByTime ?? planResult.departureTime), tone: "text-mint-200" },
            { label: "Arrive", value: formatClock(planResult.arrivalTime), tone: "text-white" },
          ].map((tile, index) => <motion.div
            key={tile.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * index }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{tile.label}</p>
            <p className={`mt-1 font-score text-2xl font-bold ${tile.tone}`}>{tile.value}</p>
          </motion.div>)}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Travel</p>
            <p className="mt-1 font-score text-2xl font-bold text-white"><AnimatedNumber value={Math.ceil(planResult.durationMinutes)} /> min</p>
          </motion.div>
        </div>

        {planResult.steps.length > 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h4 className="flex items-center gap-2 font-semibold text-white"><Route size={17} className="text-mint-300" aria-hidden="true" />Your route</h4>
          <ol className="mt-4 space-y-2">
            {planResult.steps.map((step, index) => <motion.li
              key={`${step}-${index}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              className="flex items-start gap-3 text-sm text-slate-200"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.06] text-sm" aria-hidden="true">{stepEmoji(step, transport === "Transit" ? "TRANSIT" : "DRIVE")}</span>
              <span className="pt-1">{step}</span>
            </motion.li>)}
          </ol>
        </div>}

        {planResult.warnings.length > 0 && <InlineAlert tone="warning">{planResult.warnings.join(" ")}</InlineAlert>}

        {arrivalTime && <SavePlanButton
          key={`${game.id}-${routeCalculatedAt}`}
          input={{
            gameId: game.id,
            origin: origin.trim(),
            travelMode: transport === "Transit" ? "TRANSIT" : "DRIVE",
            targetArrivalTime: arrivalTime,
            preferences: { budget, pregame },
            itinerary: {},
            routeSnapshot: planResult,
            routeCalculatedAt,
          }}
        />}

        <a
          href={directionsUrl(origin.trim(), `${game.venue}, Philadelphia, PA`, transport === "Transit" ? "TRANSIT" : "DRIVE")}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-sm font-semibold text-mint-200 transition hover:text-white"
        >Open in Google Maps <ExternalLink size={15} aria-hidden="true" /></a>

        <p className="text-xs text-slate-500">
          {planResult.durationKind === "estimated"
            ? "Driving times are estimates and can change with traffic."
            : "Transit times come from the scheduled service."} Route data from Google.
        </p>
      </motion.div>}
    </AnimatePresence>
  </Sheet>;
}
