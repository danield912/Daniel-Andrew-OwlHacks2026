"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Search,
  Ticket,
} from "lucide-react";

type Game = {
  id: string;
  name: string;
  team: string;
  startTime: string | null;
  venue: string;
};

type TicketmasterEvent = {
  id: string;
  name: string;
  dates?: {
    start?: {
      dateTime?: string;
      dateTBD?: boolean;
      dateTBA?: boolean;
      timeTBA?: boolean;
      noSpecificTime?: boolean;
    };
  };
  _embedded?: {
    venues?: { name?: string }[];
  };
};

const teams = ["All teams", "Eagles", "Phillies", "76ers", "Temple"];

const inputClass =
  "mt-2 w-full rounded-xl border border-white/15 bg-[#14272d] " +
  "px-4 py-3 text-white outline-none focus-visible:ring-2 " +
  "focus-visible:ring-teal-300";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "bg-teal-300 px-5 py-3 font-semibold text-slate-950 " +
  "transition hover:bg-teal-200 motion-safe:hover:-translate-y-0.5 " +
  "focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-white focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[#09171b]";

function getTeam(name: string) {
  const lower = name.toLowerCase();

  if (lower.includes("eagles")) return "Eagles";
  if (lower.includes("phillies")) return "Phillies";
  if (lower.includes("76ers") || lower.includes("sixers")) return "76ers";
  if (lower.includes("temple") && lower.includes("football")) return "Temple";

  return null;
}

function formatTime(value: string | null) {
  if (!value) return "Date or time to be confirmed";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function GamePlanHome() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("All teams");
  const [selected, setSelected] = useState<Game | null>(null);

  const [origin, setOrigin] = useState("");
  const [transport, setTransport] = useState("Transit");
  const [budget, setBudget] = useState("$ — Budget-friendly");
  const [pregame, setPregame] = useState("Food");
  const [buffer, setBuffer] = useState("45");
  const [showSummary, setShowSummary] = useState(false);

  const formHeading = useRef<HTMLHeadingElement>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadGames() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/games", {
          signal: controller.signal,
        });

        if (
          response.redirected ||
          !response.headers.get("content-type")?.includes("application/json")
        ) {
          throw new Error("Please sign in to load upcoming games.");
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "We couldn’t load the games.");
        }

        const events: TicketmasterEvent[] = data._embedded?.events ?? [];

        const upcoming: Game[] = events.flatMap((event) => {
          const eventTeam = getTeam(event.name);
          if (!eventTeam) return [];

          const start = event.dates?.start;
          const uncertain =
            start?.dateTBD ||
            start?.dateTBA ||
            start?.timeTBA ||
            start?.noSpecificTime;

          const dateTime = start?.dateTime;
          const validDate =
            !!dateTime && Number.isFinite(Date.parse(dateTime));

          if (validDate && Date.parse(dateTime) < Date.now()) return [];

          return [{
            id: event.id,
            name: event.name,
            team: eventTeam,
            startTime: !uncertain && validDate ? dateTime : null,
            venue:
              event._embedded?.venues?.[0]?.name || "Venue to be confirmed",
          }];
        });

        upcoming.sort(
          (a, b) =>
            (a.startTime ? Date.parse(a.startTime) : Infinity) -
            (b.startTime ? Date.parse(b.startTime) : Infinity),
        );

        setGames(upcoming);
      } catch (caught) {
        if (controller.signal.aborted) return;

        setError(
          caught instanceof Error
            ? caught.message
            : "Something went wrong. Please try again.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadGames();
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (selected) formHeading.current?.focus();
  }, [selected]);

  useEffect(() => {
    if (showSummary) summaryHeading.current?.focus();
  }, [showSummary]);

  const visibleGames = games.filter(
    (game) =>
      (team === "All teams" || game.team === team) &&
      `${game.name} ${game.venue}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  const arrivalTime = selected?.startTime
    ? new Date(
        Date.parse(selected.startTime) - Number(buffer) * 60_000,
      ).toISOString()
    : null;

  return (
    <div className="min-h-screen bg-[#09171b] text-slate-100">
      <header className="border-b border-white/10 bg-[#0d2026]">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5"
        >
          <Link href="/" className="flex items-center gap-3 font-bold">
            <span className="rounded-xl bg-teal-300 p-2 text-slate-950">
              <Ticket aria-hidden="true" size={22} />
            </span>
            Philly GamePlan
          </Link>

          <Link
            href="/auth/login"
            className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-teal-300"
          >
            Account
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:py-12">
        <section className="relative overflow-hidden rounded-3xl border border-teal-300/20 bg-gradient-to-br from-teal-900/70 via-[#133039] to-[#17232d] p-7 sm:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[32px] border-teal-200/5"
          />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">
            Your city. Your crew. Your game.
          </p>
          <h1 className="mt-4 max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">
            Great game.
            <br />
            Even better day.
          </h1>
          <p className="mt-4 max-w-lg leading-relaxed text-slate-300">
            Pick your game, set your vibe, and start planning your Philly outing.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-200/10 px-4 py-2 text-sm text-amber-200">
            <MapPin size={16} aria-hidden="true" />
            Philadelphia, PA
          </div>
        </section>

        <section aria-labelledby="games-heading">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 id="games-heading" className="text-2xl font-bold">
                Find your next game
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Available listings · All times in Philadelphia time
              </p>
            </div>

            <div className="relative w-full sm:max-w-xs">
              <label htmlFor="game-search" className="sr-only">
                Search games or venues
              </label>
              <Search
                size={18}
                aria-hidden="true"
                className="absolute left-3 top-3.5 text-slate-400"
              />
              <input
                id="game-search"
                type="search"
                placeholder="Search games or venues"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={`${inputClass} mt-0 pl-10`}
              />
            </div>
          </div>

          <div
            aria-label="Filter by team"
            className="my-5 flex flex-wrap gap-2"
          >
            {teams.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={team === name}
                onClick={() => setTeam(name)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-teal-300 ${
                  team === name
                    ? "bg-teal-300 text-slate-950"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          {loading ? (
            <div role="status">
              <span className="sr-only">Loading games…</span>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    aria-hidden="true"
                    className="h-64 rounded-2xl border border-white/10 bg-white/5 motion-safe:animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-2xl border border-amber-300/30 bg-amber-300/5 p-6"
            >
              <p className="font-semibold">{error}</p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button
                  className={buttonClass}
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Try again
                </button>
                <Link href="/auth/login" className="underline">
                  Sign in
                </Link>
              </div>
            </div>
          ) : visibleGames.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/20 p-8 text-center">
              <h3 className="text-lg font-semibold">No matching games found</h3>
              <p className="mt-2 text-slate-400">
                Try another team or clear your search. Listings may be limited.
              </p>
              <button
                className={`${buttonClass} mt-5`}
                onClick={() => {
                  setQuery("");
                  setTeam("All teams");
                }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleGames.map((game) => (
                <article
                  key={game.id}
                  className={`flex flex-col rounded-2xl border bg-[#11252c] p-6 transition duration-200 motion-safe:hover:-translate-y-1 hover:shadow-lg hover:shadow-teal-950/40 ${
                    selected?.id === game.id
                      ? "border-teal-300"
                      : "border-white/10 hover:border-teal-300/40"
                  }`}
                >
                  <span className="w-fit rounded-full bg-teal-300/10 px-3 py-1 text-xs font-bold text-teal-200">
                    {game.team}
                  </span>
                  <h3 className="mb-5 mt-4 text-xl font-semibold">
                    {game.name}
                  </h3>
                  <p className="flex items-start gap-2 text-sm text-slate-300">
                    <CalendarDays size={17} className="shrink-0" aria-hidden="true" />
                    {formatTime(game.startTime)}
                  </p>
                  <p className="mb-6 mt-3 flex items-start gap-2 text-sm text-slate-300">
                    <MapPin size={17} className="shrink-0" aria-hidden="true" />
                    {game.venue}
                  </p>
                  <button
                    className={`${buttonClass} mt-auto w-full`}
                    onClick={() => {
                      setSelected(game);
                      setShowSummary(false);
                    }}
                  >
                    {selected?.id === game.id ? "Selected game" : "Plan this game"}
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {selected && (
          <section className="rounded-3xl border border-white/10 bg-[#10232a] p-6 sm:p-8">
            <p className="text-sm font-semibold text-teal-200">
              Your selected game
            </p>
            <h2
              ref={formHeading}
              tabIndex={-1}
              className="mt-2 text-2xl font-bold"
            >
              Make the day yours
            </h2>
            <p className="mt-2 text-slate-300">{selected.name}</p>

            <form
              className="mt-6 grid gap-5 sm:grid-cols-2"
              onChange={() => setShowSummary(false)}
              onSubmit={(event) => {
                event.preventDefault();
                if (!origin.trim()) return;
                setShowSummary(true);
              }}
            >
              <label className="text-sm font-medium sm:col-span-2">
                Where are you starting?
                <input
                  required
                  maxLength={200}
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value)}
                  placeholder="Street address, neighborhood, or town"
                  className={inputClass}
                />
              </label>

              <label className="text-sm font-medium">
                How are you getting there?
                <select
                  value={transport}
                  onChange={(event) => setTransport(event.target.value)}
                  className={inputClass}
                >
                  <option>Transit</option>
                  <option>Driving</option>
                </select>
              </label>

              <label className="text-sm font-medium">
                Food budget
                <select
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  className={inputClass}
                >
                  <option>$ — Budget-friendly</option>
                  <option>$$ — Mid-range</option>
                  <option>$$$ — Treat ourselves</option>
                </select>
              </label>

              <label className="text-sm font-medium">
                Before the game
                <select
                  value={pregame}
                  onChange={(event) => setPregame(event.target.value)}
                  className={inputClass}
                >
                  <option>Food</option>
                  <option>Bar / hangout</option>
                  <option>Straight to the stadium</option>
                </select>
              </label>

              <label className="text-sm font-medium">
                Arrive at the stadium
                <select
                  value={buffer}
                  onChange={(event) => setBuffer(event.target.value)}
                  className={inputClass}
                >
                  <option value="30">30 minutes before the game</option>
                  <option value="45">45 minutes before the game</option>
                  <option value="60">60 minutes before the game</option>
                </select>
              </label>

              <div className="sm:col-span-2">
                <button type="submit" className={buttonClass}>
                  Preview my preferences
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
                <p className="mt-3 text-xs text-slate-400">
                  Preview only. Your plan isn’t saved yet.
                </p>
              </div>
            </form>
          </section>
        )}

        {showSummary && selected && (
          <section
            aria-labelledby="summary-heading"
            className="rounded-3xl border border-teal-300/30 bg-gradient-to-br from-teal-950 to-[#10232a] p-6 sm:p-8"
          >
            <CheckCircle2 className="text-teal-300" aria-hidden="true" />
            <h2
              id="summary-heading"
              ref={summaryHeading}
              tabIndex={-1}
              className="mt-3 text-2xl font-bold"
            >
              Here’s your starting plan
            </h2>

            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              {[
                ["Game", selected.name],
                ["Starting from", origin.trim()],
                ["Transportation", transport],
                ["Food budget", budget],
                ["Pregame", pregame],
                ["Target stadium arrival", formatTime(arrivalTime)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-slate-400">{label}</dt>
                  <dd className="mt-1 font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-6 rounded-xl bg-white/5 p-4 text-sm text-slate-300">
              {arrivalTime
                ? "This is your target arrival, not a departure estimate. Routes and restaurant recommendations come next. Game times may change."
                : "The game’s start time is unconfirmed. A timed itinerary will be available once the time is known."}
            </p>
          </section>
        )}

        <footer className="border-t border-white/10 py-6 text-sm text-slate-400">
          Philly GamePlan · Made for the whole game day.
        </footer>
      </main>
    </div>
  );
}