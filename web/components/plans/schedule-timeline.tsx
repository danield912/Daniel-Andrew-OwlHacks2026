import type { ReactNode } from "react";
import { directionsUrl, planTime, type SavedPlan } from "@/lib/saved-plans";
import { estimatedGameEnd, stadiumArrival } from "@/lib/game-day";

type TimelineItem = {
  key: string;
  time: string;
  order: number; // breaks ties when two items share a time
  title: string;
  tone: "route" | "stop" | "game";
  detail?: ReactNode;
};

const toneClass = {
  route: "text-teal-200",
  stop: "text-amber-200",
  game: "text-red-300",
};

const linkClass = "mt-1 inline-block text-sm text-teal-200 underline";

export function ScheduleTimeline({ plan }: { plan: SavedPlan }) {
  const route = plan.routeSnapshot;
  const venue = `${plan.game.venue.name}, ${plan.game.venue.address}`;
  const stops = plan.stops ?? [];
  const items: TimelineItem[] = [];

  if (route) {
    items.push({
      key: "leave",
      time: route.leaveByTime || route.departureTime,
      order: 0,
      title: "Leave by",
      tone: "route",
      detail: <>
        <p className="mt-1 text-slate-300">{plan.origin}</p>
        {route.steps.length > 0 && <ol className="mt-2 space-y-1 text-sm text-slate-400">
          {route.steps.map((step, index) => <li key={index}>{step}</li>)}
        </ol>}
      </>,
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
      tone: "stop",
      detail: <>
        {stop.place?.address && <p className="mt-1 text-slate-300">{stop.place.address}</p>}
        {!stop.place && <p className="mt-1 text-sm text-slate-400">Place details are unavailable right now.</p>}
        <a
          className={linkClass}
          href={directionsUrl(venue, where, "WALK")}
          target="_blank"
          rel="noopener noreferrer"
        >Walking directions from the stadium ↗</a>
      </>,
    });
  }

  items.push({
    key: "arrival",
    time: stadiumArrival(plan),
    order: 1,
    title: route ? "Arrive at the stadium area" : "Arrive by",
    tone: "route",
    detail: <p className="mt-1 text-slate-300">{plan.game.venue.name}</p>,
  });
  items.push({ key: "kickoff", time: plan.game.startsAt, order: 3, title: "Game starts", tone: "game" });
  if (stops.some(stop => stop.slot === "after")) {
    items.push({ key: "end", time: estimatedGameEnd(plan), order: 4, title: "Game ends (estimate)", tone: "game" });
  }

  items.sort((a, b) => Date.parse(a.time) - Date.parse(b.time) || a.order - b.order);

  return <>
    <ol className="my-7 space-y-6 border-l border-teal-300/30 pl-6">
      {items.map(item => <li key={item.key}>
        <p className={`font-semibold ${toneClass[item.tone]}`}>{planTime(item.time)} — {item.title}</p>
        {item.detail}
      </li>)}
    </ol>
  </>;
}
