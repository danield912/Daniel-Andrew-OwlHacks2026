"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { ExternalLink } from "lucide-react";
import { directionsUrl, planTime, type SavedPlan } from "@/lib/saved-plans";
import { estimatedGameEnd, placeEmoji, stadiumArrival, viewerTrip } from "@/lib/game-day";
import { teamLook } from "@/lib/team-style";
import { stepEmoji } from "@/lib/route-steps";
import { planTeam } from "./shared";

type TimelineItem = {
  key: string;
  time: string;
  order: number; // breaks ties when two items share a time
  title: string;
  emoji: string;
  tone: "route" | "stop" | "game";
  detail?: ReactNode;
  unknownTime?: boolean; // shown as "—" (time only used for ordering)
};

const tone = {
  route: { time: "text-mint-200", dot: "bg-mint-300/15 ring-mint-300/40" },
  stop: { time: "text-amber-200", dot: "bg-amber-300/15 ring-amber-300/40" },
  game: { time: "text-rose-200", dot: "bg-rose-400/15 ring-rose-400/40" },
};

const linkClass = "mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-mint-200 transition hover:text-white";

export function ScheduleTimeline({ plan }: { plan: SavedPlan }) {
  const trip = viewerTrip(plan);
  const route = trip?.route ?? null;
  const team = planTeam(plan);
  const venue = `${plan.game.venue.name}, ${plan.game.venue.address}`;
  const stops = plan.stops ?? [];
  const items: TimelineItem[] = [];
  const mode = trip?.travelMode ?? plan.travelMode;

  if (route) {
    items.push({
      key: "leave",
      time: route.leaveByTime || route.departureTime,
      order: 0,
      title: "Leave",
      emoji: "🏠",
      tone: "route",
      detail: <>
        <p className="mt-1 text-slate-300">{trip?.origin}</p>
        {route.steps.length > 0 && <ol className="mt-3 space-y-1.5 rounded-2xl bg-white/[0.03] p-3 text-sm text-slate-300">
          {route.steps.map((step, index) => <li key={index} className="flex gap-2"><span aria-hidden="true">{stepEmoji(step, mode)}</span><span>{step}</span></li>)}
        </ol>}
      </>,
    });
  }

  if (!trip) {
    items.push({
      key: "no-start",
      time: new Date(Date.parse(plan.targetArrivalTime) - 60 * 60_000).toISOString(),
      order: 0,
      title: "When to leave",
      emoji: "📍",
      unknownTime: true,
      tone: "route",
      detail: <a href="#my-start" className={linkClass}>Add where you’re coming from to get your leave time</a>,
    });
  }

  for (const stop of stops) {
    const name = stop.place?.name ?? "Saved spot";
    const where = stop.place?.address || name;
    items.push({
      key: `${stop.slot}-${stop.placeId}-${stop.time}`,
      time: stop.time,
      order: stop.slot === "before" ? 2 : 5,
      title: stop.slot === "before" ? `Pregame · ${name}` : `After the game · ${name}`,
      emoji: placeEmoji(stop.place?.category),
      tone: "stop",
      detail: <>
        {stop.place?.address && <p className="mt-1 text-slate-300">{stop.place.address}</p>}
        {!stop.place && <p className="mt-1 text-sm text-slate-400">Place details are unavailable right now.</p>}
        <a className={linkClass} href={directionsUrl(venue, where, "WALK")} target="_blank" rel="noopener noreferrer">
          Walking directions from the stadium <ExternalLink size={14} aria-hidden="true" />
        </a>
      </>,
    });
  }

  items.push({
    key: "arrival",
    time: stadiumArrival(plan),
    order: 1,
    title: route ? "Arrive at the stadium area" : "Arrive by",
    emoji: "🏟️",
    tone: "route",
    detail: <p className="mt-1 text-slate-300">{plan.game.venue.name}{route && <> · {Math.ceil(route.durationMinutes)} min trip by {mode === "TRANSIT" ? "SEPTA 🚇" : "car 🚗"}</>}</p>,
  });
  items.push({ key: "kickoff", time: plan.game.startsAt, order: 3, title: "Game starts", emoji: teamLook(team).emoji, tone: "game" });
  if (stops.some(stop => stop.slot === "after")) {
    items.push({ key: "end", time: estimatedGameEnd(plan), order: 4, title: "Game ends (estimate)", emoji: "🏁", tone: "game" });
  }

  items.sort((a, b) => Date.parse(a.time) - Date.parse(b.time) || a.order - b.order);

  return <ol className="relative mt-6 space-y-1">
    <span aria-hidden="true" className="absolute bottom-6 left-[23px] top-6 w-px bg-gradient-to-b from-mint-300/50 via-amber-300/40 to-rose-400/50" />
    {items.map((item, index) => <motion.li
      key={item.key}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 260, damping: 24 }}
      className="relative flex gap-4 rounded-2xl p-2 transition-colors hover:bg-white/[0.03]"
    >
      <span className={`relative z-10 grid h-8 w-8 shrink-0 translate-x-[7px] place-items-center rounded-full text-base ring-1 backdrop-blur ${tone[item.tone].dot}`} aria-hidden="true">{item.emoji}</span>
      <div className="min-w-0 flex-1 pb-3">
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className={`font-score text-lg font-bold tabular ${tone[item.tone].time}`}>{item.unknownTime ? "—" : planTime(item.time).replace(/^.*?, /, "")}</span>
          <span className="font-semibold text-white">{item.title}</span>
        </p>
        {item.detail}
      </div>
    </motion.li>)}
  </ol>;
}
