"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, CloudSun, ExternalLink, Ticket } from "lucide-react";
import { myMember, planTime, ticketLink, type SavedPlan } from "@/lib/saved-plans";
import { Skeleton } from "@/components/gp/states";

type WeatherHour = {
  at: string;
  label: string;
  temperature: number;
  unit: "F" | "C";
  forecast: string;
  precipChance: number | null;
  wind: string;
  isDaytime: boolean;
  emoji: string;
};
type Weather = { available: true; hours: WeatherHour[] } | { available: false; reason: string };

type Item = { id: string; emoji: string; text: string; hint?: string };

const clock = (iso: string) => planTime(iso).replace(/^.*?, /, "");

// Stadium bag rules. The NFL's clear-bag policy is league-wide; for the other
// venues we point people to the team's policy instead of guessing sizes.
function bagItem(venue: string): Item {
  if (/lincoln financial/i.test(venue)) {
    return { id: "bag", emoji: "👜", text: "Clear bag only", hint: "NFL clear-bag policy: a clear bag up to 12″ × 6″ × 12″, or a small clutch." };
  }
  if (/citizens bank/i.test(venue)) return { id: "bag", emoji: "👜", text: "Small bag only", hint: "Check the Phillies’ ballpark bag policy before you go." };
  return { id: "bag", emoji: "👜", text: "Small bag only", hint: "Check the venue’s bag policy before you go." };
}

function buildChecklist(plan: SavedPlan, weather: Weather | null): Item[] {
  const me = myMember(plan);
  const mode = me?.start?.travelMode ?? plan.travelMode;
  const kickoff = weather?.available ? weather.hours.find(hour => hour.label === "Kickoff") ?? weather.hours[0] : null;
  const wettest = weather?.available ? Math.max(...weather.hours.map(hour => hour.precipChance ?? 0)) : 0;
  const coldest = weather?.available ? Math.min(...weather.hours.map(hour => hour.temperature)) : null;
  const hottest = weather?.available ? Math.max(...weather.hours.map(hour => hour.temperature)) : null;
  const tailgate = plan.stops?.some(stop => stop.placeId === "tailgate");
  const bar = /bar/i.test(plan.preferences.pregame) || plan.stops?.some(stop => /bar|pub/i.test(stop.place?.category ?? ""));

  const items: Item[] = [
    { id: "tickets", emoji: "🎟️", text: "Tickets on your phone", hint: "Add them to your wallet so they work without signal." },
    bagItem(plan.game.venue.name),
    mode === "TRANSIT"
      ? { id: "fare", emoji: "💳", text: "SEPTA fare ready", hint: "Load your SEPTA Key card, or bring a card or cash for fares." }
      : { id: "parking", emoji: "🅿️", text: "Parking plan", hint: "Stadium lots fill up well before kickoff." },
    { id: "battery", emoji: "🔋", text: "Phone charged", hint: "For tickets, live location, and the ride home." },
  ];
  if (wettest >= 40) items.push({ id: "rain", emoji: "🧥", text: "Rain jacket or poncho", hint: `Up to ${wettest}% chance of rain.` });
  if (coldest !== null && coldest <= 50) items.push({ id: "layers", emoji: "🧤", text: "Warm layers", hint: `Down to ${coldest}°${kickoff?.unit ?? "F"}.` });
  if (hottest !== null && hottest >= 80) items.push({ id: "sun", emoji: "🧴", text: "Sunscreen and water", hint: `Up to ${hottest}°${kickoff?.unit ?? "F"}.` });
  if (tailgate) items.push({ id: "tailgate", emoji: "🔥", text: "Tailgate supplies", hint: "Chairs, cooler, and a speaker for the lot." });
  if (bar) items.push({ id: "id", emoji: "🪪", text: "ID for the bar", hint: "Most spots near the stadium check at the door." });
  items.push({ id: "colors", emoji: "🎽", text: "Wear your team’s colors" });
  return items;
}

// Weather, a packing checklist tailored to the game, and a tickets link.
export function GameDayKit({ plan }: { plan: SavedPlan }) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const storageKey = `gp-kit-${plan.id}`;

  useEffect(() => {
    try { setChecked(JSON.parse(localStorage.getItem(storageKey) || "{}")); } catch { /* storage blocked */ }
  }, [storageKey]);

  useEffect(() => {
    let active = true;
    fetch(`/api/plans/${encodeURIComponent(plan.id)}/weather`, { cache: "no-store" })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as Weather; })
      .then(data => { if (active) setWeather(data); })
      .catch(() => { if (active) setWeatherError(true); });
    return () => { active = false; };
  }, [plan.id]);

  const items = useMemo(() => buildChecklist(plan, weather), [plan, weather]);
  const done = items.filter(item => checked[item.id]).length;

  function toggle(id: string) {
    setChecked(current => {
      const next = { ...current, [id]: !current[id] };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage blocked */ }
      return next;
    });
  }

  return <section aria-labelledby="kit-heading" className="gp-panel p-5 sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="gp-eyebrow">Before you go</p>
        <h2 id="kit-heading" className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">Game-day kit</h2>
      </div>
      <a
        href={ticketLink(plan.game)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-mint-300 to-glow-cyan px-5 font-semibold text-night-950 shadow-glow-sm transition hover:-translate-y-0.5 hover:shadow-glow"
      ><Ticket size={17} aria-hidden="true" />Get tickets<ExternalLink size={14} aria-hidden="true" /></a>
    </div>

    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {/* Weather */}
      <div>
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400"><CloudSun size={15} aria-hidden="true" />Weather at the stadium</h3>
        {!weather && !weatherError ? <div className="mt-3 grid grid-cols-3 gap-2" role="status"><span className="sr-only">Loading forecast…</span>{[1, 2, 3].map(item => <Skeleton key={item} className="h-28" />)}</div>
        : weatherError || !weather ? <p className="mt-3 rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-400">The forecast isn’t available right now.</p>
        : !weather.available ? <p className="mt-3 rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-300">⛅ {weather.reason}</p>
        : <ul className="mt-3 grid grid-cols-3 gap-2">
          {weather.hours.map((hour, index) => <motion.li
            key={hour.at}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{hour.label}</p>
            <motion.p animate={{ y: [0, -3, 0] }} transition={{ duration: 3, repeat: Infinity, delay: index * 0.4 }} className="mt-1 text-3xl" aria-hidden="true">{hour.emoji}</motion.p>
            <p className="font-score text-2xl font-bold text-white">{hour.temperature}°</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-300">{hour.forecast}</p>
            <p className="mt-1 text-[11px] text-slate-500">{clock(hour.at)}{hour.precipChance ? ` · 💧${hour.precipChance}%` : ""}</p>
          </motion.li>)}
        </ul>}
        {weather?.available && <p className="mt-2 text-[11px] text-slate-500">Forecast from the National Weather Service.</p>}
      </div>

      {/* Checklist */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Packing list</h3>
          <span className="text-xs font-semibold text-mint-200 tabular">{done}/{items.length} ready</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-mint-300 to-glow-cyan" animate={{ width: `${(done / items.length) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
        <ul className="mt-3 space-y-1.5">
          <AnimatePresence initial={false}>
            {items.map(item => {
              const on = Boolean(checked[item.id]);
              return <motion.li key={item.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(item.id)}
                  className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${on ? "bg-mint-300/[0.07]" : "hover:bg-white/[0.04]"}`}
                >
                  <motion.span
                    animate={on ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${on ? "border-mint-300 bg-mint-300 text-night-950" : "border-white/25"}`}
                  >{on && <Check size={13} strokeWidth={3} aria-hidden="true" />}</motion.span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${on ? "text-slate-400 line-through" : "text-white"}`}><span aria-hidden="true">{item.emoji} </span>{item.text}</span>
                    {item.hint && <span className="block text-xs text-slate-500">{item.hint}</span>}
                  </span>
                </button>
              </motion.li>;
            })}
          </AnimatePresence>
        </ul>
        {done === items.length && <p className="mt-3 text-sm font-semibold text-mint-200">All set. Enjoy the game! 🎉</p>}
      </div>
    </div>
  </section>;
}
