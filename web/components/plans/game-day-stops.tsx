"use client";
import { useEffect, useState } from "react";
import { Check, MapPin, Plus, Star, Trash2 } from "lucide-react";
import {
  canInvite,
  planTime,
  type Place,
  type PlanStop,
  type SavedPlan,
  type StopInput,
  type StopSlot,
} from "@/lib/saved-plans";
import { phillyClockTime, phillyTimeOnGameDay } from "@/lib/philly-time";
import {
  MAX_STOPS,
  budgetLevel,
  defaultStopTime,
  groupLabels,
  pregameWindow,
  placeGroup,
  priceLabel,
  skipsPregame,
  slotLabels,
  stopTimeError,
  walkLabel,
  type PlaceGroup,
} from "@/lib/game-day";
import { actionClass, panelClass } from "./shared";

const chipClass = (active: boolean) =>
  `rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-teal-300 ${
    active ? "bg-teal-300 text-slate-950" : "bg-white/5 text-slate-300 hover:bg-white/10"
  }`;
const smallButtonClass = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-teal-300 disabled:opacity-60";

async function stopsRequest(path: string, init: RequestInit, fallback: string) {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Game-day spots aren’t connected yet. Please try again once the API is ready.");
  }
  const data = await response.json();
  if (response.status === 401) throw new Error("Please sign in again, then retry.");
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

// Turns a Philadelphia "HH:MM" into a timestamp. After-game times past midnight
// belong to the next day (e.g. 12:30 AM after an 8:20 PM kickoff).
function stopTimeToIso(plan: SavedPlan, slot: StopSlot, clock: string) {
  const iso = phillyTimeOnGameDay(plan.game.startsAt, clock);
  if (!iso) return null;
  if (slot === "after" && Date.parse(iso) <= Date.parse(plan.game.startsAt)) {
    return new Date(Date.parse(iso) + 24 * 60 * 60_000).toISOString();
  }
  return iso;
}

export function GameDayStops({ plan, onStopsChange }: {
  plan: SavedPlan;
  onStopsChange: (stops: PlanStop[]) => void;
}) {
  const stops = plan.stops ?? [];
  const canEdit = canInvite(plan.role);
  const budget = budgetLevel(plan.preferences.budget);

  const [slot, setSlot] = useState<StopSlot>(skipsPregame(plan.preferences.pregame) ? "after" : "before");
  const [group, setGroup] = useState<PlaceGroup>("all");
  const [showBeforeAnyway, setShowBeforeAnyway] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const [adding, setAdding] = useState<{ placeId: string; clock: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const skipped = slot === "before" && skipsPregame(plan.preferences.pregame) && !showBeforeAnyway;

  useEffect(() => {
    if (skipped) return;
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ slot });
    stopsRequest(`/api/plans/${encodeURIComponent(plan.id)}/suggestions?${params}`, {
      signal: AbortSignal.timeout(15000),
    }, "We couldn’t find spots right now.")
      .then(data => {
        if (!Array.isArray(data.places)) throw new Error("The spots response was unexpected. Please try again.");
        if (active) setPlaces(data.places);
      })
      .catch(caught => {
        if (!active) return;
        setPlaces([]);
        setError(caught instanceof Error && caught.name === "TimeoutError"
          ? "Finding spots took too long. Please try again."
          : caught instanceof Error ? caught.message : "We couldn’t find spots right now.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [plan.id, slot, attempt, skipped]);

  const groupCounts = {
    all: places.length,
    food: places.filter(place => placeGroup(place) === "food").length,
    bar: places.filter(place => placeGroup(place) === "bar").length,
  };
  const shown = group === "all" ? places : places.filter(place => placeGroup(place) === group);
  const slotStops = stops.filter(stop => stop.slot === slot);

  async function saveStops(next: StopInput[]) {
    setSaving(true);
    setSaveError("");
    try {
      const data = await stopsRequest(`/api/plans/${encodeURIComponent(plan.id)}/stops`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stops: next }),
        signal: AbortSignal.timeout(15000),
      }, "We couldn’t update your stops. Please try again.");
      if (!Array.isArray(data.stops)) throw new Error("The server didn’t confirm your stops. Please refresh.");
      onStopsChange(data.stops);
      setAdding(null);
    } catch (caught) {
      setSaveError(caught instanceof Error && caught.name === "TimeoutError"
        ? "Saving took too long. Refresh to check whether your change was saved."
        : caught instanceof Error ? caught.message : "We couldn’t update your stops.");
    } finally {
      setSaving(false);
    }
  }

  const addingIso = adding ? stopTimeToIso(plan, slot, adding.clock) : null;
  const addingError = adding ? stopTimeError(plan, slot, addingIso) : "";

  function addStop() {
    if (!adding || !addingIso || addingError) return;
    const current = stops.map(({ placeId, slot, time }) => ({ placeId, slot, time }));
    saveStops([...current, { placeId: adding.placeId, slot, time: addingIso }]);
  }

  function removeStop(target: PlanStop) {
    saveStops(stops
      .filter(stop => !(stop.placeId === target.placeId && stop.slot === target.slot && stop.time === target.time))
      .map(({ placeId, slot, time }) => ({ placeId, slot, time })));
  }

  return <section aria-labelledby="game-day-heading" className={panelClass}>
    <h2 id="game-day-heading" className="text-2xl font-bold">Make a day of it</h2>
    <p className="mt-2 text-sm text-slate-400">
      Spots near {plan.game.venue.name}. {canEdit
        ? `Add up to ${MAX_STOPS} stops to your schedule.`
        : "Only the plan leader and co-leaders can add stops."}
    </p>

    <div role="tablist" aria-label="When" className="mt-5 flex flex-wrap gap-2">
      {(["before", "after"] as const).map(value => <button
        key={value}
        role="tab"
        aria-selected={slot === value}
        onClick={() => { setSlot(value); setGroup("all"); setAdding(null); setSaveError(""); }}
        className={`rounded-xl px-5 py-3 font-semibold transition focus-visible:outline focus-visible:outline-teal-300 ${slot === value ? "bg-white/10 text-white ring-1 ring-teal-300" : "text-slate-400 hover:bg-white/5"}`}
      >{slotLabels[value]}</button>)}
    </div>

    {slotStops.length > 0 && <div className="mt-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Your {slot === "before" ? "pregame" : "after-game"} stops</h3>
      <ul className="mt-3 space-y-2">
        {slotStops.map(stop => <li key={`${stop.placeId}-${stop.time}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-teal-300/10 px-4 py-3">
          <span><span className="font-semibold text-teal-200">{planTime(stop.time)}</span> · {stop.place?.name ?? "Saved spot (details unavailable)"}</span>
          {canEdit && <button type="button" disabled={saving} onClick={() => removeStop(stop)} className={`${smallButtonClass} text-red-200 hover:bg-red-500/10`}>
            <Trash2 size={16} aria-hidden="true" />Remove
          </button>}
        </li>)}
      </ul>
    </div>}

    {slot === "before" && !skipped && pregameWindow(plan).minutes < 60 && <p className="mt-6 rounded-xl bg-amber-200/10 p-4 text-sm text-amber-100">
      You arrive at {planTime(pregameWindow(plan).start)}, only {Math.max(pregameWindow(plan).minutes, 0)} minutes before kickoff.
      For more time at the bars or tailgating, plan a new trip with an earlier “Arrive at the stadium by” time.
    </p>}

    {skipped ? <div className="mt-6 rounded-2xl border border-dashed border-white/20 p-6 text-center">
      <p className="font-semibold">You chose to head straight to the stadium.</p>
      <p className="mt-2 text-sm text-slate-400">No pregame stop needed. Changed your mind?</p>
      <button type="button" onClick={() => setShowBeforeAnyway(true)} className={`${actionClass} mt-4`}>Show pregame spots anyway</button>
    </div> : <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div aria-label="Type of place" className="flex flex-wrap gap-2">
          {(Object.keys(groupLabels) as PlaceGroup[]).map(value => <button
            key={value}
            type="button"
            aria-pressed={group === value}
            disabled={!loading && !error && value !== "all" && groupCounts[value] === 0}
            onClick={() => { setGroup(value); setAdding(null); }}
            className={`${chipClass(group === value)} disabled:cursor-not-allowed disabled:opacity-40`}
          >{groupLabels[value]}{!loading && !error ? ` (${groupCounts[value]})` : ""}</button>)}
        </div>
        <p className="text-sm text-slate-400">Showing spots within your budget ({priceLabel(budget)})</p>
      </div>

      {saveError && <p role="alert" className="mt-4 rounded-xl bg-amber-200/10 p-4 text-sm text-amber-100">{saveError}</p>}

      {loading ? <div role="status" className="mt-5">
        <span className="sr-only">Finding spots…</span>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(item => <div key={item} aria-hidden="true" className="h-40 rounded-2xl bg-white/5 motion-safe:animate-pulse" />)}
        </div>
      </div> : error ? <div role="alert" className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/5 p-6">
        <p className="font-semibold text-amber-100">{error}</p>
        <button type="button" onClick={() => setAttempt(n => n + 1)} className={`${actionClass} mt-4`}>Try again</button>
      </div> : shown.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-white/20 p-6 text-center">
        <p className="font-semibold">No {group === "all" ? "" : `${groupLabels[group].toLowerCase()} `}spots found nearby in your budget.</p>
        <p className="mt-2 text-sm text-slate-400">{group === "all" ? "Try the other tab, or open Google Maps to look around." : "Try All to see every spot."}</p>
        {group !== "all" && <button type="button" onClick={() => setGroup("all")} className={`${actionClass} mt-4`}>Show all spots</button>}
      </div> : <>
        <ul className="mt-5 grid gap-4 md:grid-cols-2">
          {shown.map(place => {
            const added = stops.some(stop => stop.placeId === place.placeId && stop.slot === slot);
            const isAdding = adding?.placeId === place.placeId;
            return <li key={place.placeId} className={`flex flex-col rounded-2xl border bg-[#11252c] p-5 ${added ? "border-teal-300/60" : "border-white/10"}`}>
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-lg font-semibold">{place.name}</h4>
                <span className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">{place.category}</span>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-300">
                <span className="font-semibold text-teal-200">{priceLabel(place.priceLevel)}</span>
                {place.rating !== null && <span className="flex items-center gap-1">
                  <Star size={14} aria-hidden="true" className="fill-amber-300 text-amber-300" />
                  {place.rating.toFixed(1)}{place.ratingCount != null && <span className="text-slate-400">({place.ratingCount.toLocaleString()})</span>}
                </span>}
                {place.walkMinutes !== null && <span>{walkLabel(place.walkMinutes)}</span>}
              </p>
              <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-400"><MapPin size={14} aria-hidden="true" className="mt-0.5 shrink-0" />{place.address}</p>

              {isAdding ? <div className="mt-4 rounded-xl bg-white/5 p-4">
                <label className="text-sm font-medium">
                  {slot === "before" ? "Be there at" : "Head there at"}
                  <input
                    type="time"
                    step={300}
                    autoFocus
                    value={adding.clock}
                    onChange={event => setAdding({ placeId: place.placeId, clock: event.target.value })}
                    aria-invalid={Boolean(addingError)}
                    aria-describedby={`time-hint-${place.placeId}`}
                    className="mt-2 w-full rounded-xl border border-white/15 bg-[#14272d] px-4 py-3 text-white [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
                  />
                </label>
                <p id={`time-hint-${place.placeId}`} className={`mt-2 text-xs ${addingError ? "text-amber-200" : "text-slate-400"}`}>
                  {addingError || `Philadelphia time · ${planTime(addingIso!)}`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={saving || Boolean(addingError)} onClick={addStop} className={`${smallButtonClass} bg-teal-300 text-slate-950 hover:bg-teal-200`}>
                    {saving ? "Adding…" : "Add stop"}
                  </button>
                  <button type="button" disabled={saving} onClick={() => setAdding(null)} className={`${smallButtonClass} text-slate-300 hover:bg-white/10`}>Cancel</button>
                </div>
              </div> : <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                {added ? <span className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-teal-200"><Check size={16} aria-hidden="true" />Added</span>
                  : canEdit && <button
                    type="button"
                    disabled={saving || stops.length >= MAX_STOPS}
                    title={stops.length >= MAX_STOPS ? `Plans can have up to ${MAX_STOPS} stops.` : undefined}
                    onClick={() => { setSaveError(""); setAdding({ placeId: place.placeId, clock: phillyClockTime(defaultStopTime(plan, slot)) }); }}
                    className={`${smallButtonClass} bg-teal-300 text-slate-950 hover:bg-teal-200`}
                  ><Plus size={16} aria-hidden="true" />Add to plan</button>}
                <a href={place.mapsUrl} target="_blank" rel="noopener noreferrer" className={`${smallButtonClass} text-teal-200 hover:bg-white/10`}>Directions ↗</a>
              </div>}
            </li>;
          })}
        </ul>
        {canEdit && stops.length >= MAX_STOPS && <p className="mt-4 text-sm text-slate-400">You’ve reached {MAX_STOPS} stops. Remove one to add another.</p>}
      </>}
      <p className="mt-5 text-xs text-slate-400">Walk times are straight-line estimates. Place information from Google.</p>
    </>}
  </section>;
}
