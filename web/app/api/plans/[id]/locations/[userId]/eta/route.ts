import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/plan-access";
import { etaTo, EtaError, jsonError, liveContext, memberTrip, missedRideNote, nextTarget, PRIVATE_HEADERS, publicTarget } from "@/lib/live";

// GET /api/plans/[id]/locations/[userId]/eta  (called when a friend is tapped)
// -> { target: { kind, name, at }, etaAt, minutes, lateByMinutes, calculatedAt } or { target: null }.
// Uses Google Routes from their live location. Never stored.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  const ctx = await liveContext(await createClient(), id);
  if (ctx instanceof NextResponse) return ctx;
  if (!UUID_PATTERN.test(userId)) return jsonError("They aren’t sharing their location.", 404);

  const { data: location, error } = await ctx.supabase
    .from("plan_locations")
    .select("lat,lng")
    .eq("plan_id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return jsonError("We couldn’t load their location. Please try again.", 500);
  if (!location) return jsonError("They aren’t sharing their location.", 404);

  const target = await nextTarget(ctx.plan);
  if (!target) return NextResponse.json({ target: null }, { headers: PRIVATE_HEADERS });

  // Their own travel mode and route (everyone starts from their own address).
  const trip = await memberTrip(ctx.supabase, id, userId, ctx.plan.travelMode);
  try {
    const at = { lat: location.lat, lng: location.lng };
    const eta = await etaTo(at, target, trip.travelMode);
    return NextResponse.json(
      { target: publicTarget(target), ...eta, travelMode: trip.travelMode, note: missedRideNote(trip, at) },
      { headers: PRIVATE_HEADERS },
    );
  } catch (caught) {
    const message = caught instanceof EtaError ? caught.message : "ETAs are temporarily unavailable. Please try again.";
    return jsonError(message, 502);
  }
}
