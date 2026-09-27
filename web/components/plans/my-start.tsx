"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lock, MapPin, Navigation, Pencil, Save } from "lucide-react";
import { planTime, type MemberStart, type RouteSnapshot, type SavedPlan } from "@/lib/saved-plans";
import { Button } from "@/components/gp/button";
import { ChoiceGroup } from "@/components/gp/choice";
import { InlineAlert } from "@/components/gp/states";
import { useToast } from "@/components/gp/toast";
import { useUser } from "@/components/gp/user";
import { TransitStatus, ridesOn } from "./transit-status";

type Travel = "TRANSIT" | "DRIVE";

async function jsonRequest(path: string, init: RequestInit, fallback: string) {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error(fallback);
  const data = await response.json();
  if (response.status === 401) throw new Error("Please sign in again, then retry.");
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

function clock(iso: string) {
  return planTime(iso).replace(/^.*?, /, "");
}

// "Where are you coming from?" Each person in the crew adds their own start,
// gets their own leave time, and shows up as a pin on the crew map.
export function MyStart({ plan, start, welcome = false, onSaved }: {
  plan: SavedPlan;
  start: MemberStart | null;
  welcome?: boolean;
  onSaved: (start: MemberStart) => void;
}) {
  const toast = useToast();
  const { defaults } = useUser();
  const [editing, setEditing] = useState(false);
  const [origin, setOrigin] = useState(start?.origin ?? (plan.role === "leader" ? plan.origin : defaults.origin ?? ""));
  const [travel, setTravel] = useState<Travel>(start?.travelMode ?? (defaults.travelMode === "Driving" ? "DRIVE" : "TRANSIT"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (origin.trim().length < 2) return;
    setSaving(true);
    setError("");
    try {
      // 1. Your own route to arrive by the plan's arrival time.
      let route: RouteSnapshot | null = null;
      let routeNote = "";
      try {
        const data = await jsonRequest("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId: plan.gameId, origin: origin.trim(), travelMode: travel, targetArrivalTime: plan.targetArrivalTime }),
        }, "We couldn’t calculate your route.");
        if (data.status === "ok") route = data as RouteSnapshot;
        else routeNote = data.message || "No route arrives in time from there.";
      } catch (caught) {
        routeNote = caught instanceof Error ? caught.message : "We couldn’t calculate your route.";
      }

      // 2. Save it (the server also pins the address on the map).
      const data = await jsonRequest(`/api/plans/${encodeURIComponent(plan.id)}/start`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: origin.trim(), travelMode: travel, route, routeCalculatedAt: route ? new Date().toISOString() : undefined }),
        signal: AbortSignal.timeout(20000),
      }, "We couldn’t save your starting point. Please try again.");

      onSaved(data.start as MemberStart);
      setEditing(false);
      toast.success({
        title: route ? `You’re on the map 📍 Leave by ${clock(route.leaveByTime || route.departureTime)}` : "You’re on the map 📍",
        body: data.warning || (routeNote ? `${routeNote} Use Directions for travel times.` : "Your crew can see where you’re coming from."),
      });
    } catch (caught) {
      setError(caught instanceof Error && caught.name === "TimeoutError"
        ? "Saving took too long. Please try again."
        : caught instanceof Error ? caught.message : "We couldn’t save your starting point.");
    } finally {
      setSaving(false);
    }
  }

  const showForm = !start || editing;
  const route = start?.route ?? null;

  return <section id="my-start" aria-labelledby="my-start-heading" className={`scroll-mt-24 overflow-hidden rounded-3xl border shadow-lift ${showForm ? "border-mint-300/30 bg-gradient-to-br from-mint-300/[0.1] via-night-800/80 to-glow-cyan/[0.08] p-5 sm:p-7" : "gp-glass p-5 sm:p-6"}`}>
    <AnimatePresence mode="wait" initial={false}>
      {showForm ? <motion.form key="form" onSubmit={save} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
        <div className="flex items-start gap-4">
          <motion.span
            aria-hidden="true"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mint-300/15 text-2xl"
          >{welcome ? "🎉" : "📍"}</motion.span>
          <div>
            <h2 id="my-start-heading" className="font-display text-xl font-bold text-white sm:text-2xl">
              {welcome ? "Welcome to the crew! Where are you coming from?" : "Where are you coming from?"}
            </h2>
            <p className="mt-1 text-sm text-slate-300">Everyone leaves from somewhere different. Add yours to get your own leave time and a pin on the crew map.</p>
          </div>
        </div>
        <div>
          <label htmlFor="my-origin" className="gp-label">Your starting address</label>
          <div className="relative">
            <Navigation size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mint-300" aria-hidden="true" />
            <input
              id="my-origin"
              required
              autoFocus={welcome}
              maxLength={200}
              value={origin}
              onChange={event => setOrigin(event.target.value)}
              placeholder="Street address, neighborhood, or campus"
              autoComplete="street-address"
              className="gp-input pl-11"
            />
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400"><Lock size={12} aria-hidden="true" />Only people in this plan can see it.</p>
        </div>
        <ChoiceGroup<Travel>
          label="How are you getting there?"
          value={travel}
          onChange={setTravel}
          columns={2}
          disabled={saving}
          options={[
            { value: "TRANSIT", label: "SEPTA", hint: "Train or bus", icon: "🚇" },
            { value: "DRIVE", label: "Driving", hint: "Car or rideshare", icon: "🚗" },
          ]}
        />
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={saving} loadingText="Finding your route…" disabled={origin.trim().length < 2} icon={<Save size={17} aria-hidden="true" />}>Save my start</Button>
          {start && <Button variant="ghost" disabled={saving} onClick={() => { setEditing(false); setError(""); }}>Cancel</Button>}
        </div>
      </motion.form> : <motion.div key="summary" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="my-start-heading" className="font-display text-lg font-bold text-white">Your trip</h2>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} icon={<Pencil size={14} aria-hidden="true" />}>Edit</Button>
        </div>
        <p className="mt-1 flex items-start gap-2 text-sm text-slate-300"><MapPin size={15} className="mt-0.5 shrink-0 text-mint-300" aria-hidden="true" />{start!.origin}</p>
        {route ? <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: "Leave by", value: clock(route.leaveByTime || route.departureTime), tone: "text-mint-200" },
            { label: "Arrive", value: clock(route.arrivalTime), tone: "text-white" },
            { label: start!.travelMode === "TRANSIT" ? "🚇 SEPTA" : "🚗 Drive", value: `${Math.ceil(route.durationMinutes)} min`, tone: "text-white" },
          ].map(tile => <div key={tile.label} className="rounded-2xl bg-white/[0.04] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{tile.label}</p>
            <p className={`mt-0.5 font-score text-xl font-bold ${tile.tone}`}>{tile.value}</p>
          </div>)}
        </div> : <p className="mt-3 rounded-2xl bg-white/[0.04] p-3 text-sm text-slate-300">
          No saved leave time from here. Use Directions for current travel times, or edit your start to try again.
        </p>}
        {route && start!.travelMode === "TRANSIT" && <TransitStatus lines={ridesOn(route.steps)} />}
        {!start!.location && <p className="mt-3 text-xs text-amber-200">Your pin isn’t on the map yet. Edit and save again to add it.</p>}
      </motion.div>}
    </AnimatePresence>
  </section>;
}
