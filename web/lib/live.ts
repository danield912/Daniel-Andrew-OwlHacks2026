// Server helpers for the live group map (locations, ETAs, late alerts).
import { NextResponse } from "next/server";
import type { createClient } from "@/lib/supabase/server";
import { loadPlanForViewer, UUID_PATTERN, type PlanForViewer } from "@/lib/plan-access";
import {
  distanceMeters,
  savedStops,
  TAILGATE_PLACE_ID,
  venueLocation,
  withPlaceDetails,
  type LatLng,
} from "@/lib/places";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
export const LATE_THRESHOLD_MINUTES = 10;
export const AUTO_CHECK_EVERY_MS = 3 * 60_000;
// An automatic alert is only updated when it gets at least this much worse.
export const MUCH_WORSE_MINUTES = 10;

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: PRIVATE_HEADERS });
}

// ---------- Access ----------

export type LiveWindow = { startsAt: string; endsAt: string; isOpen: boolean };

export type LiveContext = {
  supabase: Supabase;
  userId: string;
  plan: PlanForViewer;
  window: LiveWindow;
};

// Signed-in member of the plan, with the plan's game-day window.
// Returns a ready-made error response otherwise (401 / 404 / 500).
export async function liveContext(
  supabase: Supabase,
  planId: string,
): Promise<LiveContext | NextResponse> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError("Please sign in.", 401);
  if (!UUID_PATTERN.test(planId)) return jsonError("Plan not found.", 404);

  // Remove anything past its game-day window before reading or writing.
  await supabase.rpc("purge_expired_live_data");

  const plan = await loadPlanForViewer(supabase, planId, authData.user.id);
  if (plan === "error") return jsonError("We couldn’t load this plan. Please try again.", 500);
  if (!plan) return jsonError("Plan not found.", 404);

  const { data, error } = await supabase.rpc("plan_live_window", { p_plan_id: planId });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return jsonError("We couldn’t load this plan. Please try again.", 500);

  return {
    supabase,
    userId: authData.user.id,
    plan,
    window: {
      startsAt: new Date(row.starts_at).toISOString(),
      endsAt: new Date(row.ends_at).toISOString(),
      isOpen: Boolean(row.is_open),
    },
  };
}

export function windowClosedMessage(window: LiveWindow) {
  if (Date.now() < Date.parse(window.startsAt)) {
    const opens = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(window.startsAt));
    return `Location sharing opens on game day (${opens}, 3 hours before your arrival time).`;
  }
  return "Location sharing has ended for this game.";
}

// userId -> display name, for members of this plan.
export async function memberNames(supabase: Supabase, planId: string) {
  const { data } = await supabase.rpc("get_plan_members", { p_plan_id: planId });
  const names = new Map<string, string>();
  for (const member of (data ?? []) as Array<{ user_id: string; name: string }>) {
    names.set(member.user_id, member.name);
  }
  return names;
}

// ---------- Next stop ----------

export type TargetKind = "stop" | "stadium" | "kickoff";

// What an alert stores: only a place ID for stops, never place names.
export type StoredTarget = { kind: TargetKind; at: string; placeId: string | null };

export type ResolvedTarget = StoredTarget & { name: string; location: LatLng | null };

export function targetKey(target: StoredTarget) {
  return `${target.kind}:${target.placeId ?? ""}:${target.at}`;
}

// The group's next stop: whichever comes first in time among the pregame stops,
// the stadium at the arrive-by time, and kickoff. null when nothing is left.
export async function nextTarget(plan: PlanForViewer, now = Date.now()): Promise<ResolvedTarget | null> {
  const candidates: StoredTarget[] = [
    ...savedStops(plan.itinerary)
      .filter((stop) => stop.slot === "before")
      .map((stop) => ({ kind: "stop" as const, at: stop.time, placeId: stop.placeId })),
    { kind: "stadium" as const, at: plan.targetArrivalTime, placeId: null },
    ...(plan.game.startsAt ? [{ kind: "kickoff" as const, at: plan.game.startsAt, placeId: null }] : []),
  ]
    .filter((target) => Number.isFinite(Date.parse(target.at)) && Date.parse(target.at) > now)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  for (const target of candidates) {
    const resolved = (await resolveTargets([target], plan))[0];
    // Skip a stop Google can't describe right now; fall through to the next one.
    if (resolved.kind === "stop" && !resolved.location) continue;
    return resolved;
  }
  return null;
}

// Adds fresh names/locations to stored targets (one Places lookup per stop).
export async function resolveTargets(targets: StoredTarget[], plan: PlanForViewer): Promise<ResolvedTarget[]> {
  const venue = plan.game.venue;
  const venueAt = venueLocation(venue);
  const venueName = venue?.name ?? "the stadium";

  const stopIds = [...new Set(
    targets.filter((t) => t.kind === "stop" && t.placeId && t.placeId !== TAILGATE_PLACE_ID).map((t) => t.placeId!),
  )];
  const details = new Map<string, { name: string; location: LatLng } | null>();
  if (stopIds.length && venue) {
    const looked = await withPlaceDetails(
      stopIds.map((placeId) => ({ placeId, slot: "before" as const, time: plan.targetArrivalTime })),
      venue,
    );
    for (const stop of looked) details.set(stop.placeId, stop.place);
  }

  return targets.map((target) => {
    if (target.kind !== "stop") return { ...target, name: venueName, location: venueAt };
    if (target.placeId === TAILGATE_PLACE_ID) {
      return { ...target, name: `Tailgate at ${venueName}`, location: venueAt };
    }
    const place = target.placeId ? details.get(target.placeId) : null;
    return { ...target, name: place?.name ?? "Next stop", location: place?.location ?? null };
  });
}

// ---------- ETA (Google Routes, never stored) ----------

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

export class EtaError extends Error {}

async function routeSeconds(from: LatLng, to: LatLng, mode: "WALK" | "TRANSIT" | "DRIVE") {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) throw new EtaError("ETAs are not configured yet.");
  let response: Response;
  try {
    response = await fetch(ROUTES_URL, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.duration",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: mode,
        ...(mode === "DRIVE" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
      }),
    });
  } catch {
    throw new EtaError("ETAs are temporarily unavailable. Please try again.");
  }
  if (!response.ok) {
    if (response.status !== 400 && response.status !== 404) {
      console.error("Routes ETA failed", response.status, (await response.text()).slice(0, 300));
      throw new EtaError("ETAs are temporarily unavailable. Please try again.");
    }
    return null;
  }
  const data = (await response.json().catch(() => null)) as { routes?: Array<{ duration?: string }> } | null;
  const seconds = Number(data?.routes?.[0]?.duration?.replace(/s$/, ""));
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

export type Eta = { etaAt: string; minutes: number; lateByMinutes: number; calculatedAt: string };

// Walk when close (under 1.5 km), otherwise the plan's travel mode; falls back to walking.
export async function etaTo(from: LatLng, target: ResolvedTarget, travelMode: "TRANSIT" | "DRIVE"): Promise<Eta> {
  if (!target.location) throw new EtaError("This stop doesn't have a map location right now.");
  const now = Date.now();
  const close = distanceMeters(from, target.location) < 1_500;
  let seconds = await routeSeconds(from, target.location, close ? "WALK" : travelMode);
  if (seconds === null && !close) seconds = await routeSeconds(from, target.location, "WALK");
  if (seconds === null) throw new EtaError("No route was found to the next stop.");

  const etaAt = now + seconds * 1_000;
  return {
    etaAt: new Date(etaAt).toISOString(),
    minutes: Math.ceil(seconds / 60),
    lateByMinutes: Math.max(0, Math.ceil((etaAt - Date.parse(target.at)) / 60_000)),
    calculatedAt: new Date(now).toISOString(),
  };
}

export function publicTarget(target: ResolvedTarget | null) {
  return target ? { kind: target.kind, name: target.name, at: new Date(target.at).toISOString() } : null;
}

// ---------- Alerts ----------

export type AlertRow = {
  id: string;
  user_id: string;
  kind: "manual" | "auto";
  minutes_late: number;
  target: StoredTarget | null;
  eta: string | null;
  note: string | null;
  created_at: string;
};

export const ALERT_COLUMNS = "id,user_id,kind,minutes_late,target,eta,note,created_at";

export async function serializeAlerts(rows: AlertRow[], ctx: LiveContext) {
  const names = await memberNames(ctx.supabase, ctx.plan.id);
  const stored = rows.map((row) => row.target).filter((t): t is StoredTarget => Boolean(t?.kind && t?.at));
  const resolved = await resolveTargets(stored, ctx.plan);
  const byKey = new Map(resolved.map((t) => [targetKey(t), t]));

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: names.get(row.user_id) ?? "Someone",
    kind: row.kind,
    minutesLate: row.minutes_late,
    target: row.target ? publicTarget(byKey.get(targetKey(row.target)) ?? null) : null,
    eta: row.eta ? new Date(row.eta).toISOString() : null,
    note: row.note,
    createdAt: new Date(row.created_at).toISOString(),
    isYou: row.user_id === ctx.userId,
  }));
}

// Called from PUT /location. At most once every 3 minutes per person: if their
// ETA to the next stop is 10+ minutes late, create one alert for that stop, and
// only update it when it gets much worse. Never throws.
export async function autoLateCheck(ctx: LiveContext, at: LatLng) {
  try {
    const cutoff = new Date(Date.now() - AUTO_CHECK_EVERY_MS).toISOString();
    // Claim the check first so parallel updates can't double up.
    const { data: claimed } = await ctx.supabase
      .from("plan_locations")
      .update({ eta_checked_at: new Date().toISOString() })
      .eq("plan_id", ctx.plan.id)
      .eq("user_id", ctx.userId)
      .or(`eta_checked_at.is.null,eta_checked_at.lt.${cutoff}`)
      .select("plan_id");
    if (!claimed?.length) return;

    const target = await nextTarget(ctx.plan);
    if (!target) return;
    const eta = await etaTo(at, target, ctx.plan.travelMode);
    if (eta.lateByMinutes < LATE_THRESHOLD_MINUTES) return;

    const stored: StoredTarget = { kind: target.kind, at: target.at, placeId: target.placeId };
    const key = targetKey(stored);
    const { data: existing } = await ctx.supabase
      .from("plan_alerts")
      .select("id,minutes_late")
      .eq("plan_id", ctx.plan.id)
      .eq("user_id", ctx.userId)
      .eq("kind", "auto")
      .eq("target_key", key)
      .maybeSingle();

    if (!existing) {
      await ctx.supabase.from("plan_alerts").insert({
        plan_id: ctx.plan.id,
        user_id: ctx.userId,
        kind: "auto",
        minutes_late: Math.min(eta.lateByMinutes, 600),
        target: stored,
        target_key: key,
        eta: eta.etaAt,
      });
    } else if (eta.lateByMinutes >= existing.minutes_late + MUCH_WORSE_MINUTES) {
      // Re-surface it (new createdAt) so polling with ?since= picks it up.
      await ctx.supabase
        .from("plan_alerts")
        .update({
          minutes_late: Math.min(eta.lateByMinutes, 600),
          eta: eta.etaAt,
          created_at: new Date().toISOString(),
          dismissed_at: null,
        })
        .eq("id", existing.id);
    }
  } catch (caught) {
    console.error("auto late check failed", caught instanceof Error ? caught.message : caught);
  }
}
