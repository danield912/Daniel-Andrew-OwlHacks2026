"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ExternalLink, Footprints, Lightbulb, MapPin, Plus, Send, Star, Trash2, X } from "lucide-react";
import {
  canEditStops,
  myMember,
  planTime,
  type Place,
  type PlanStop,
  type SavedPlan,
  type StopInput,
  type StopSlot,
  type StopSuggestion,
} from "@/lib/saved-plans";
import { phillyClockTime, phillyTimeOnGameDay } from "@/lib/philly-time";
import {
  MAX_STOPS,
  budgetLevel,
  defaultStopTime,
  groupLabels,
  placeEmoji,
  placeGroup,
  pregameWindow,
  priceLabel,
  skipsPregame,
  stopTimeError,
  walkLabel,
  type PlaceGroup,
} from "@/lib/game-day";
import { Button } from "@/components/gp/button";
import { FilterChips, SegmentedTabs } from "@/components/gp/tabs";
import { EmptyState, ErrorState, InlineAlert, Skeleton } from "@/components/gp/states";
import { staggerChild, staggerParent } from "@/components/gp/reveal";
import { useToast } from "@/components/gp/toast";

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

function Stars({ rating }: { rating: number }) {
  return <span className="flex items-center gap-1" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
    <Star size={14} aria-hidden="true" className="fill-amber-300 text-amber-300" />
    <span className="font-semibold text-white">{rating.toFixed(1)}</span>
  </span>;
}

export function GameDayStops({ plan, onStopsChange, onSuggestionsChange }: {
  plan: SavedPlan;
  onStopsChange: (stops: PlanStop[]) => void;
  onSuggestionsChange: (suggestions: StopSuggestion[]) => void;
}) {
  const toast = useToast();
  const stops = plan.stops ?? [];
  // Leader edits the plan directly; co-leaders and members suggest.
  const canEdit = canEditStops(plan.role);
  const me = myMember(plan);
  const suggestions = plan.suggestions ?? [];
  const [reviewingId, setReviewingId] = useState<string | null>(null);
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
  const pregame = pregameWindow(plan);

  async function saveStops(next: StopInput[], success: string) {
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
      toast.success(success);
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

  async function sendSuggestion(place: Place) {
    if (!adding || !addingIso || addingError) return;
    setSaving(true);
    setSaveError("");
    try {
      const data = await stopsRequest(`/api/plans/${encodeURIComponent(plan.id)}/stop-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: place.placeId, slot, time: addingIso }),
        signal: AbortSignal.timeout(15000),
      }, "We couldn’t send your suggestion.");
      onSuggestionsChange([{
        id: data.suggestion.id,
        placeId: place.placeId,
        slot,
        time: addingIso,
        status: "pending",
        createdAt: new Date().toISOString(),
        suggestedBy: { userId: me?.userId ?? "", name: me?.name ?? "You", isYou: true },
        place: { name: place.name, address: place.address, location: place.location, category: place.category },
      }, ...suggestions]);
      setAdding(null);
      toast.success({ title: "Suggestion sent 📨", body: "The leader will approve or decline it." });
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "We couldn’t send your suggestion.");
    } finally {
      setSaving(false);
    }
  }

  async function review(suggestion: StopSuggestion, decision: "approve" | "decline") {
    setReviewingId(suggestion.id);
    setSaveError("");
    try {
      const data = await stopsRequest(`/api/plans/${encodeURIComponent(plan.id)}/stop-suggestions/${encodeURIComponent(suggestion.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      }, "We couldn’t update that suggestion.");
      if (Array.isArray(data.stops)) onStopsChange(data.stops);
      onSuggestionsChange(suggestions.filter(item => item.id !== suggestion.id));
      toast.success(decision === "approve"
        ? `${placeEmoji(suggestion.place?.category)} ${suggestion.place?.name ?? "Spot"} added to the plan`
        : "Suggestion declined");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn’t update that suggestion.");
    } finally {
      setReviewingId(null);
    }
  }

  async function withdraw(suggestion: StopSuggestion) {
    setReviewingId(suggestion.id);
    try {
      await stopsRequest(`/api/plans/${encodeURIComponent(plan.id)}/stop-suggestions/${encodeURIComponent(suggestion.id)}`, { method: "DELETE" }, "We couldn’t withdraw that suggestion.");
      onSuggestionsChange(suggestions.filter(item => item.id !== suggestion.id));
      toast.info("Suggestion withdrawn");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn’t withdraw that suggestion.");
    } finally {
      setReviewingId(null);
    }
  }

  const slotSuggestions = suggestions.filter(item => item.slot === slot && (item.status === "pending" || item.suggestedBy.isYou));
  const pendingFor = (placeId: string) => suggestions.find(item => item.placeId === placeId && item.slot === slot && item.status === "pending");

  function addStop(place: Place) {
    if (!adding || !addingIso || addingError) return;
    const current = stops.map(({ placeId, slot, time }) => ({ placeId, slot, time }));
    saveStops([...current, { placeId: adding.placeId, slot, time: addingIso }], `${placeEmoji(place.category)} ${place.name} added`);
  }

  function removeStop(target: PlanStop) {
    saveStops(stops
      .filter(stop => !(stop.placeId === target.placeId && stop.slot === target.slot && stop.time === target.time))
      .map(({ placeId, slot, time }) => ({ placeId, slot, time })), "Stop removed");
  }

  return <section id="stops" aria-labelledby="game-day-heading" className="gp-panel scroll-mt-24 p-5 sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="gp-eyebrow">Pregame · Postgame</p>
        <h2 id="game-day-heading" className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">Make a day of it</h2>
        <p className="mt-1 text-sm text-slate-400">
          Spots around {plan.game.venue.name}. {canEdit ? `Add up to ${MAX_STOPS} stops, and review your crew’s suggestions.` : "Suggest spots and the leader approves them."}
        </p>
      </div>
      <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-sm font-semibold text-slate-200 tabular">{stops.length}/{MAX_STOPS} stops</span>
    </div>

    <div className="mt-6">
      <SegmentedTabs<StopSlot>
        label="When"
        value={slot}
        fill
        onChange={value => { setSlot(value); setGroup("all"); setAdding(null); setSaveError(""); }}
        options={[
          { value: "before", label: "Before the game", icon: <span aria-hidden="true">🍻</span>, count: stops.filter(stop => stop.slot === "before").length },
          { value: "after", label: "After the game", icon: <span aria-hidden="true">🌙</span>, count: stops.filter(stop => stop.slot === "after").length },
        ]}
      />
    </div>

    <AnimatePresence initial={false}>
      {slot === "before" && !skipped && pregame.minutes < 60 && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4">
        <InlineAlert tone="warning">
          You arrive at {planTime(pregame.start)}, only {Math.max(pregame.minutes, 0)} minutes before kickoff. For more time at the bars or tailgate, plan a new trip with an earlier “Arrive at the stadium by” time.
        </InlineAlert>
      </motion.div>}
    </AnimatePresence>

    {/* Suggestions waiting for the leader (and your own recent results) */}
    <AnimatePresence initial={false}>
      {slotSuggestions.length > 0 && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
        <h3 className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-200"><Lightbulb size={14} aria-hidden="true" />{canEdit ? "Suggestions to review" : "Suggestions"}</h3>
        <ul className="mt-3 space-y-2">
          <AnimatePresence initial={false}>
            {slotSuggestions.map(item => <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16, height: 0 }}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] px-4 py-3"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-lg" aria-hidden="true">{placeEmoji(item.place?.category)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-white">{item.place?.name ?? "Suggested spot"}</span>
                  <span className="block text-xs text-slate-300"><span className="font-score text-sm font-semibold text-amber-200">{planTime(item.time)}</span> · suggested by {item.suggestedBy.isYou ? "you" : item.suggestedBy.name}</span>
                </span>
              </span>
              {item.status !== "pending" ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "approved" ? "bg-mint-300/15 text-mint-200" : "bg-white/[0.06] text-slate-400"}`}>{item.status === "approved" ? "Approved ✓" : "Declined"}</span>
                : canEdit ? <span className="flex gap-2">
                  <Button size="sm" loading={reviewingId === item.id} loadingText="Saving…" onClick={() => review(item, "approve")} icon={<Check size={15} aria-hidden="true" />}>Approve</Button>
                  <Button size="sm" variant="ghost" disabled={reviewingId === item.id} onClick={() => review(item, "decline")} icon={<X size={15} aria-hidden="true" />}>Decline</Button>
                </span>
                : item.suggestedBy.isYou ? <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-200">Waiting for the leader</span>
                  <Button size="sm" variant="ghost" disabled={reviewingId === item.id} onClick={() => withdraw(item)}>Withdraw</Button>
                </span>
                : <span className="text-xs font-semibold text-amber-200">Waiting for the leader</span>}
            </motion.li>)}
          </AnimatePresence>
        </ul>
      </motion.div>}
    </AnimatePresence>

    {/* Chosen stops for this tab */}
    <AnimatePresence initial={false}>
      {slotStops.length > 0 && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
        <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Your {slot === "before" ? "pregame" : "after-game"} stops</h3>
        <ul className="mt-3 space-y-2">
          <AnimatePresence initial={false}>
            {slotStops.map(stop => <motion.li
              key={`${stop.placeId}-${stop.time}`}
              layout
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16, height: 0 }}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mint-300/20 bg-mint-300/[0.07] px-4 py-3"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-lg" aria-hidden="true">{placeEmoji(stop.place?.category)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-white">{stop.place?.name ?? "Saved spot (details unavailable)"}</span>
                  <span className="block font-score text-sm font-semibold text-mint-200">{planTime(stop.time)}</span>
                </span>
              </span>
              {canEdit && <Button variant="ghost" size="sm" disabled={saving} onClick={() => removeStop(stop)} icon={<Trash2 size={15} aria-hidden="true" />} className="text-rose-200 hover:bg-rose-500/10 hover:text-rose-100">Remove</Button>}
            </motion.li>)}
          </AnimatePresence>
        </ul>
      </motion.div>}
    </AnimatePresence>

    {skipped ? <EmptyState
      className="mt-6"
      emoji="🏟️"
      title="You’re heading straight in"
      body="You picked “Straight to the stadium”, so there’s no pregame stop. Changed your mind?"
      action={<Button variant="secondary" onClick={() => setShowBeforeAnyway(true)}>Show pregame spots</Button>}
    /> : <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <FilterChips<PlaceGroup>
          label="Type of place"
          value={group}
          onChange={value => { setGroup(value); setAdding(null); }}
          options={(Object.keys(groupLabels) as PlaceGroup[]).map(value => ({
            value,
            label: <>{value === "all" ? "✨" : value === "food" ? "🍔" : "🍺"} {groupLabels[value]}{!loading && !error && <span className="opacity-70">· {groupCounts[value]}</span>}</>,
          }))}
        />
        <p className="text-sm text-slate-400">Within your budget · <span className="font-semibold text-mint-200">{priceLabel(budget)}</span></p>
      </div>

      <AnimatePresence>{saveError && <InlineAlert tone="error" className="mt-4">{saveError}</InlineAlert>}</AnimatePresence>

      <div className="mt-5">
        {loading ? <div role="status" className="grid gap-4 md:grid-cols-2">
          <span className="sr-only">Finding spots…</span>
          {[1, 2, 3, 4].map(item => <div key={item} className="gp-glass rounded-3xl p-5">
            <div className="flex gap-3"><Skeleton className="h-12 w-12" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></div></div>
            <Skeleton className="mt-5 h-9 w-2/3" />
          </div>)}
        </div> : error ? <ErrorState title="We couldn’t find spots" message={error} onRetry={() => setAttempt(n => n + 1)} /> : shown.length === 0 ? <EmptyState
          emoji={group === "bar" ? "🍺" : group === "food" ? "🍔" : "🗺️"}
          title="No spots found nearby"
          body={group === "all" ? "Try the other tab, or open Google Maps to look around." : "Try All to see every spot."}
          action={group !== "all" && <Button variant="secondary" onClick={() => setGroup("all")}>Show all spots</Button>}
        /> : <motion.ul key={`${slot}-${group}`} variants={staggerParent} initial="hidden" animate="shown" className="grid gap-4 md:grid-cols-2">
          {shown.map(place => {
            const added = stops.some(stop => stop.placeId === place.placeId && stop.slot === slot);
            const isAdding = adding?.placeId === place.placeId;
            return <motion.li
              key={place.placeId}
              variants={staggerChild}
              layout
              whileHover={{ y: -4 }}
              className={`group relative flex flex-col rounded-3xl border p-5 transition-colors ${added ? "border-mint-300/50 bg-mint-300/[0.06]" : "border-white/[0.08] bg-night-800/60 hover:border-white/20"}`}
            >
              <div className="flex items-start gap-3">
                <motion.span whileHover={{ rotate: [0, -10, 10, 0] }} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.07] text-2xl" aria-hidden="true">{placeEmoji(place.category)}</motion.span>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold leading-snug text-white">{place.name}</h4>
                  <p className="text-sm text-slate-400">{place.category}</p>
                </div>
                {added && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mint-300 text-night-950" aria-label="Added"><Check size={16} strokeWidth={3} aria-hidden="true" /></span>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300">
                {place.priceLevel !== null && <span className="font-score text-base font-bold text-mint-200">{priceLabel(place.priceLevel)}</span>}
                {place.rating !== null && <Stars rating={place.rating} />}
                {place.ratingCount != null && <span className="text-slate-500">({place.ratingCount.toLocaleString()})</span>}
                {place.walkMinutes !== null && <span className="flex items-center gap-1"><Footprints size={14} aria-hidden="true" />{walkLabel(place.walkMinutes)}</span>}
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-500"><MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{place.address}</p>

              <AnimatePresence initial={false} mode="wait">
                {isAdding ? <motion.div
                  key="adding"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 rounded-2xl border border-white/10 bg-night-900/60 p-4">
                    <label htmlFor={`time-${place.placeId}`} className="gp-label">{slot === "before" ? "Be there at" : "Head there at"}</label>
                    <input
                      id={`time-${place.placeId}`}
                      type="time"
                      step={300}
                      autoFocus
                      value={adding.clock}
                      onChange={event => setAdding({ placeId: place.placeId, clock: event.target.value })}
                      aria-invalid={Boolean(addingError)}
                      aria-describedby={`time-hint-${place.placeId}`}
                      className="gp-input"
                    />
                    <p id={`time-hint-${place.placeId}`} className={`mt-2 text-xs ${addingError ? "text-amber-200" : "text-slate-400"}`}>
                      {addingError || `Philadelphia time · ${planTime(addingIso!)}`}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canEdit
                        ? <Button size="sm" loading={saving} loadingText="Adding…" disabled={Boolean(addingError)} onClick={() => addStop(place)} icon={<Check size={16} aria-hidden="true" />}>Add stop</Button>
                        : <Button size="sm" loading={saving} loadingText="Sending…" disabled={Boolean(addingError)} onClick={() => sendSuggestion(place)} icon={<Send size={15} aria-hidden="true" />}>Send suggestion</Button>}
                      <Button size="sm" variant="ghost" disabled={saving} onClick={() => setAdding(null)}>Cancel</Button>
                    </div>
                  </div>
                </motion.div> : <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                  {added ? <span className="px-1 text-sm font-semibold text-mint-200">In your plan ✓</span>
                    : pendingFor(place.placeId) ? <span className="px-1 text-sm font-semibold text-amber-200">💡 Suggested · waiting for leader</span>
                    : !canEdit ? <Button
                      size="sm"
                      variant="secondary"
                      disabled={saving}
                      onClick={() => { setSaveError(""); setAdding({ placeId: place.placeId, clock: phillyClockTime(defaultStopTime(plan, slot)) }); }}
                      icon={<Lightbulb size={15} aria-hidden="true" />}
                    >Suggest</Button>
                    : <Button
                      size="sm"
                      disabled={saving || stops.length >= MAX_STOPS}
                      title={stops.length >= MAX_STOPS ? `Plans can have up to ${MAX_STOPS} stops.` : undefined}
                      onClick={() => { setSaveError(""); setAdding({ placeId: place.placeId, clock: phillyClockTime(defaultStopTime(plan, slot)) }); }}
                      icon={<Plus size={16} aria-hidden="true" />}
                    >Add to plan</Button>}
                  <a href={place.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.07] hover:text-white">
                    Directions <ExternalLink size={14} aria-hidden="true" />
                  </a>
                </motion.div>}
              </AnimatePresence>
            </motion.li>;
          })}
        </motion.ul>}
      </div>
      {canEdit && stops.length >= MAX_STOPS && <p className="mt-4 text-sm text-slate-400">You’ve reached {MAX_STOPS} stops. Remove one to add another.</p>}
      <p className="mt-5 text-xs text-slate-500">Walk times are straight-line estimates. Place information from Google.</p>
    </>}
  </section>;
}
