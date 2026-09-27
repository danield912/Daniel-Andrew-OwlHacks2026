"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, ExternalLink, MapPin, Navigation, RefreshCw, Route } from "lucide-react";
import { ROLE_INFO, type PlanMember, type SavedPlan } from "@/lib/saved-plans";
import { stepEmoji } from "@/lib/route-steps";
import {
  TONE_LOOK,
  alertHeadline,
  clock,
  distanceLabel,
  lateTone,
  liveRequest,
  LiveError,
  metersBetween,
  timeAgo,
  type EtaResult,
} from "@/lib/live-client";
import { Sheet } from "@/components/gp/modal";
import { Button } from "@/components/gp/button";
import { Skeleton } from "@/components/gp/states";
import { initialsOf } from "@/components/gp/user";
import { AVATAR_COLORS, avatarIndex } from "./members-list";
import { RunningLateButton } from "./live-ui";
import type { Live } from "./use-live";

function mapsTo(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// Tapping someone on the map or in the crew list opens this: their live status
// and ETA, their route from where they started, and any late alerts.
export function MemberCard({ plan, member, live, open, onClose }: {
  plan: SavedPlan;
  member: PlanMember | null;
  live: Live;
  open: boolean;
  onClose: () => void;
}) {
  const liveSpot = member ? live.locations.find(location => location.userId === member.userId) : undefined;
  const alert = member ? live.latestAlert.get(member.userId) : undefined;
  const [eta, setEta] = useState<EtaResult | null>(null);
  const [etaState, setEtaState] = useState<"idle" | "loading" | "error">("idle");
  const [etaError, setEtaError] = useState("");

  const loadEta = useCallback(async () => {
    if (!member || !liveSpot) return;
    setEtaState("loading");
    setEtaError("");
    try {
      const data = await liveRequest(`/api/plans/${encodeURIComponent(plan.id)}/locations/${encodeURIComponent(member.userId)}/eta`, {}, "ETAs are temporarily unavailable.");
      setEta(data as EtaResult);
      setEtaState("idle");
    } catch (caught) {
      setEta(null);
      setEtaState("error");
      setEtaError(caught instanceof LiveError && caught.status === 404 ? "They just stopped sharing their location." : caught instanceof Error ? caught.message : "ETAs are temporarily unavailable.");
    }
  }, [plan.id, member, liveSpot]);

  // Fetch the live ETA when the card opens (one Google Routes call).
  useEffect(() => {
    if (open && liveSpot) loadEta();
    if (!open) { setEta(null); setEtaState("idle"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member?.userId, Boolean(liveSpot)]);

  if (!member) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;

  const color = AVATAR_COLORS[avatarIndex(member.userId)];
  const route = member.start?.route ?? null;
  const where = liveSpot ? { lat: liveSpot.lat, lng: liveSpot.lng } : member.start?.location ?? null;
  const me = live.locations.find(location => location.isYou) ?? null;
  const myPoint = me ? { lat: me.lat, lng: me.lng } : plan.members?.find(item => item.isYou)?.start?.location ?? null;
  const distance = !member.isYou && where && myPoint ? metersBetween(myPoint, where) : null;
  const tone = eta?.lateByMinutes !== undefined ? lateTone(eta.lateByMinutes) : lateTone(alert?.minutesLate);
  const lateMinutes = eta?.lateByMinutes ?? alert?.minutesLate ?? 0;

  const header = <div className="relative h-20 overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}55, transparent 70%)` }}>
    <div className="gp-yardlines absolute inset-0 opacity-40" aria-hidden="true" />
  </div>;

  return <Sheet
    open={open}
    onClose={onClose}
    header={header}
    title={member.isYou ? `${member.name} (you)` : member.name}
    subtitle={<span className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-xs font-bold">{ROLE_INFO[member.role].emoji} {ROLE_INFO[member.role].label}</span>
      {liveSpot
        ? <span className="flex items-center gap-1.5 text-xs font-semibold text-mint-200"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-mint-300" /><span className="relative inline-flex h-2 w-2 rounded-full bg-mint-300" /></span>Live · updated {timeAgo(liveSpot.updatedAt, live.now)}</span>
        : member.start ? <span className="text-xs text-slate-400">🏠 Showing their starting point</span>
        : <span className="text-xs text-slate-400">No location yet</span>}
    </span>}
  >
    <div className="space-y-5">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-2xl border-[3px] border-white text-xl font-extrabold text-slate-950 shadow-lg" style={{ background: color, boxShadow: `0 10px 30px -10px ${color}` }} aria-hidden="true">{initialsOf(member.name)}</span>
        <div className="min-w-0 text-sm text-slate-300">
          {member.start && <p className="flex items-start gap-1.5"><MapPin size={15} className="mt-0.5 shrink-0 text-mint-300" aria-hidden="true" />Starting from {member.start.origin}</p>}
          {distance !== null && <p className="mt-1 flex items-center gap-1.5"><Navigation size={14} className="text-slate-500" aria-hidden="true" />{distanceLabel(distance)} from you</p>}
        </div>
      </div>

      {/* Late alert */}
      {alert && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} role="status" className={`rounded-2xl border p-4 ${alert.minutesLate >= 15 ? "border-rose-400/30 bg-rose-500/[0.08]" : "border-amber-300/30 bg-amber-300/[0.07]"}`}>
        <p className="flex items-start gap-2 font-semibold text-white"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />{alertHeadline(alert)}</p>
        {alert.note && <p className="mt-1 pl-7 text-sm text-slate-200">{alert.note}</p>}
        <p className="mt-1 pl-7 text-xs text-slate-400">{alert.eta ? `New ETA ${clock(alert.eta)} · ` : ""}{alert.kind === "auto" ? "Spotted automatically from their live location" : "They let the crew know"} · {timeAgo(alert.createdAt, live.now)}</p>
      </motion.div>}

      {/* Live ETA */}
      <section aria-labelledby="eta-heading" className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 id="eta-heading" className="font-semibold text-white">Live ETA</h3>
          {liveSpot && <Button variant="ghost" size="sm" onClick={loadEta} disabled={etaState === "loading"} icon={<RefreshCw size={14} className={etaState === "loading" ? "animate-spin" : ""} aria-hidden="true" />}>Refresh</Button>}
        </div>
        {!liveSpot ? <p className="mt-2 text-sm text-slate-400">
          {member.isYou ? "Share your location on the map to show your live ETA." : `${member.name.split(" ")[0]} isn’t sharing their live location, so here’s their planned trip.`}
        </p>
        : etaState === "loading" && !eta ? <div className="mt-3 space-y-2"><Skeleton className="h-7 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
        : etaState === "error" ? <p className="mt-2 text-sm text-amber-200">{etaError}</p>
        : eta && !eta.target ? <p className="mt-2 text-sm text-slate-400">Nothing left on today’s schedule.</p>
        : eta?.target && eta.etaAt ? <>
          <p className="mt-2 text-lg font-bold text-white">
            {eta.target.kind === "stadium" ? "🏟️" : eta.target.kind === "kickoff" ? "🏈" : "🍻"} Gets to {eta.target.kind === "kickoff" ? "the stadium" : eta.target.name} ~<span className="font-score text-2xl">{clock(eta.etaAt)}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-300">
            <span>{eta.minutes} min away {eta.travelMode === "DRIVE" ? "by car 🚗" : "by SEPTA or walking"}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE_LOOK[tone].chip}`}>{TONE_LOOK[tone].emoji} {TONE_LOOK[tone].label(lateMinutes)}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">Due at {clock(eta.target.at)} · live estimate from Google, not saved</p>
          {eta.note && <p className="mt-3 rounded-xl bg-amber-300/10 p-3 text-sm font-semibold text-amber-100">⚠️ {eta.note}</p>}
        </> : null}
      </section>

      {/* Their route */}
      <section aria-labelledby="route-heading" className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 id="route-heading" className="flex items-center gap-2 font-semibold text-white"><Route size={17} className="text-mint-300" aria-hidden="true" />{member.isYou ? "Your route" : "Their route"}</h3>
        {!member.start ? <p className="mt-2 text-sm text-slate-400">{member.isYou ? "You haven’t" : `${member.name.split(" ")[0]} hasn’t`} added a starting point yet.</p>
        : !route ? <p className="mt-2 text-sm text-slate-400">No saved route from {member.start.origin}.</p>
        : <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Leave by", value: clock(route.leaveByTime || route.departureTime), tone: "text-mint-200" },
              { label: "Arrive", value: clock(route.arrivalTime), tone: "text-white" },
              { label: member.start.travelMode === "TRANSIT" ? "🚇 SEPTA" : "🚗 Drive", value: `${Math.ceil(route.durationMinutes)} min`, tone: "text-white" },
            ].map(tile => <div key={tile.label} className="rounded-xl bg-white/[0.04] p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{tile.label}</p>
              <p className={`font-score text-lg font-bold ${tile.tone}`}>{tile.value}</p>
            </div>)}
          </div>
          {route.steps.length > 0 && <ol className="mt-3 space-y-2">
            {route.steps.map((step, index) => <motion.li
              key={index}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * index }}
              className="flex items-start gap-3 text-sm text-slate-200"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.06] text-sm" aria-hidden="true">{stepEmoji(step, member.start!.travelMode)}</span>
              <span className="pt-1">{step}</span>
            </motion.li>)}
          </ol>}
          <p className="mt-3 text-xs text-slate-500">Saved when they added their start. Route data from Google.</p>
        </>}
      </section>

      <div className="flex flex-wrap gap-3">
        {where && !member.isYou && <a href={mapsTo(where.lat, where.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white/[0.06] px-5 font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/10">
          Directions to {liveSpot ? "them" : "their start"} <ExternalLink size={15} aria-hidden="true" />
        </a>}
        {member.isYou && live.state === "open" && <RunningLateButton live={live} />}
      </div>
    </div>
  </Sheet>;
}
