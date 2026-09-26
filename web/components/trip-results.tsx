"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Clock3,
  MapPin,
} from "lucide-react";

type Props = {
  gameId: string;
  origin: string;
  transport: string;
  buffer: number;
  gameStart: string;
  venue: string;
};

type RouteResult = {
  status: "ok";
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  steps: string[];
  warnings: string[];
};

type View =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "unavailable"; message: string }
  | RouteResult;

type Scenario = "success" | "unavailable" | "error" | "live";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "bg-teal-300 px-5 py-3 font-semibold text-slate-950 " +
  "transition hover:bg-teal-200 focus-visible:outline " +
  "focus-visible:outline-2 focus-visible:outline-offset-4 " +
  "focus-visible:outline-teal-300";

export function TripResults({
  gameId,
  origin,
  transport,
  buffer,
  gameStart,
  venue,
}: Props) {
  const [scenario, setScenario] = useState<Scenario>("success");
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View>({ status: "loading" });

  const isDemo = scenario !== "live";
  const travelMode = transport === "Transit" ? "TRANSIT" : "DRIVE";
  const targetTime = new Date(
    Date.parse(gameStart) - buffer * 60_000,
  ).toISOString();

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setView({ status: "loading" });

    const timeout = setTimeout(() => {
      controller.abort();

      if (active) {
        setView({
          status: "error",
          message: "The request took too long. Please try again.",
        });
      }
    }, 15_000);

    async function loadRoute() {
      try {
        if (scenario !== "live") {
          // Brief delay makes the demo loading state visible.
          await new Promise((resolve) => setTimeout(resolve, 600));

          if (!active) return;

          if (scenario === "unavailable") {
            setView({
              status: "unavailable",
              message:
                "Demo: no route arrives in time. Try another mode or an earlier trip.",
            });
            return;
          }

          if (scenario === "error") {
            setView({
              status: "error",
              message: "Demo: the route service is temporarily unavailable.",
            });
            return;
          }

          setView({
            status: "ok",
            departureTime: new Date(
              Date.parse(targetTime) - 45 * 60_000,
            ).toISOString(),
            arrivalTime: targetTime,
            durationMinutes: 45,
            steps: [
              "Leave your starting location",
              "Travel to the stadium",
              "Arrive before the game",
            ],
            warnings: [
              "Sample timing only. This is not a calculated route.",
            ],
          });
          return;
        }

        const response = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId,
            origin,
            travelMode,
            arrivalBufferMinutes: buffer,
          }),
          signal: controller.signal,
        });

        if (response.redirected) {
          throw new Error("Please sign in again, then retry.");
        }

        if (
          !response.headers.get("content-type")?.includes("application/json")
        ) {
          throw new Error(
            "The planning endpoint is not ready or returned an unexpected response.",
          );
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "We couldn’t calculate your route.");
        }

        if (!active) return;

        if (data.status === "unavailable") {
          setView({
            status: "unavailable",
            message: data.message || "No suitable route was found.",
          });
          return;
        }

        if (
          data.status !== "ok" ||
          typeof data.departureTime !== "string" ||
          !Number.isFinite(Date.parse(data.departureTime)) ||
          typeof data.arrivalTime !== "string" ||
          !Number.isFinite(Date.parse(data.arrivalTime)) ||
          typeof data.durationMinutes !== "number" ||
          !Number.isFinite(data.durationMinutes) ||
          data.durationMinutes < 0 ||
          !Array.isArray(data.steps) ||
          !data.steps.every((step: unknown) => typeof step === "string") ||
          !Array.isArray(data.warnings) ||
          !data.warnings.every((warning: unknown) => typeof warning === "string")
        ) {
          throw new Error("The route response is incomplete. Please try again.");
        }

        setView(data as RouteResult);
      } catch (caught) {
        if (!active || controller.signal.aborted) return;

        setView({
          status: "error",
          message:
            caught instanceof Error
              ? caught.message
              : "Something went wrong. Please try again.",
        });
      } finally {
        clearTimeout(timeout);
      }
    }

    loadRoute();

    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [
    gameId,
    origin,
    travelMode,
    buffer,
    targetTime,
    scenario,
    attempt,
  ]);

  const directions = new URL("https://www.google.com/maps/dir/");
  directions.searchParams.set("api", "1");
  directions.searchParams.set("origin", origin);
  directions.searchParams.set("destination", `${venue}, Philadelphia, PA`);
  directions.searchParams.set(
    "travelmode",
    travelMode === "TRANSIT" ? "transit" : "driving",
  );

  return (
    <section
      aria-labelledby="trip-heading"
      className="rounded-3xl border border-teal-300/20 bg-[#10232a] p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-200">
            Your journey
          </p>
          <h2 id="trip-heading" className="mt-2 text-2xl font-bold">
            From your door to game time
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Target arrival: {formatTime(targetTime)} · Philadelphia time
          </p>
        </div>

        <span className="rounded-full bg-white/10 px-3 py-1 text-sm">
          {transport}
        </span>
      </div>

      <div className="mt-6 rounded-xl border border-amber-200/20 bg-amber-200/5 p-4">
        <label htmlFor="route-scenario" className="text-sm font-medium">
          Development preview
        </label>
        <select
          id="route-scenario"
          value={scenario}
          onChange={(event) => {
            setView({ status: "loading" });
            setScenario(event.target.value as Scenario);
          }}
          className="mt-2 w-full rounded-xl border border-white/20 bg-[#14272d] px-3 py-3 text-white focus-visible:outline focus-visible:outline-teal-300"
        >
          <option value="success">Demo — successful route</option>
          <option value="unavailable">Demo — no route available</option>
          <option value="error">Demo — service error</option>
          <option value="live">Live — connect to Andrew’s endpoint</option>
        </select>
        <p className="mt-2 text-xs text-amber-100">
          {isDemo
            ? "Simulated route. Times below are for interface testing only."
            : "Uses /api/plan. The backend must be implemented first."}
        </p>
      </div>

      <div className="mt-6" aria-live="polite" aria-busy={view.status === "loading"}>
        {view.status === "loading" && (
          <div role="status">
            <p className="mb-4 text-slate-300">Finding your way there…</p>
            <div
              aria-hidden="true"
              className="h-44 rounded-2xl bg-white/5 motion-safe:animate-pulse"
            />
          </div>
        )}

        {(view.status === "error" || view.status === "unavailable") && (
          <div className="rounded-2xl border border-amber-200/25 bg-amber-200/5 p-5">
            <AlertCircle className="text-amber-200" aria-hidden="true" />
            <h3 className="mt-3 text-lg font-semibold">
              {view.status === "error"
                ? "We couldn’t load this trip"
                : "No suitable route found"}
            </h3>
            <p className="mt-2 text-slate-300">{view.message}</p>
            <button
              type="button"
              className={`${buttonClass} mt-5`}
              onClick={() => {
                setView({ status: "loading" });
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </button>
          </div>
        )}

        {view.status === "ok" && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Leave at", formatTime(view.departureTime)],
                ["Travel time", `${Math.ceil(view.durationMinutes)} min`],
                ["Arrive at", formatTime(view.arrivalTime)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white/5 p-5">
                  <p className="text-sm text-slate-400">{label}</p>
                  <p className="mt-2 text-lg font-semibold text-teal-100">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {Date.parse(view.arrivalTime) > Date.parse(targetTime) && (
              <p className="rounded-xl bg-amber-200/10 p-4 text-amber-100">
                This route arrives after your selected target time.
              </p>
            )}

            <ol className="space-y-6 border-l border-teal-300/30 pl-6">
              <li>
                <p className="flex items-center gap-2 font-semibold">
                  <Clock3 size={17} aria-hidden="true" />
                  {formatTime(view.departureTime)} — Leave
                </p>
                <p className="mt-1 text-sm text-slate-300">{origin}</p>
              </li>

              {view.steps.map((step, index) => (
                <li key={`${index}-${step}`} className="text-sm text-slate-300">
                  {step}
                </li>
              ))}

              <li>
                <p className="flex items-center gap-2 font-semibold">
                  <MapPin size={17} aria-hidden="true" />
                  {formatTime(view.arrivalTime)} — Stadium arrival
                </p>
                <p className="mt-1 text-sm text-slate-300">{venue}</p>
              </li>

              <li>
                <p className="font-semibold text-amber-200">
                  {formatTime(gameStart)} — Game starts
                </p>
              </li>
            </ol>

            {view.warnings.map((warning, index) => (
              <p
                key={`${index}-${warning}`}
                className="rounded-xl bg-amber-200/10 p-4 text-sm text-amber-100"
              >
                {warning}
              </p>
            ))}

            <a
              href={directions.toString()}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass}
            >
              Open directions
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <p className="text-xs text-slate-400">
              Opens Google Maps with your origin and destination. Check the
              travel date and time there; its route may differ from this plan.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}