import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadPlanForViewer, UUID_PATTERN } from "@/lib/plan-access";
import { savedStops, venueLocation, withPlaceDetails } from "@/lib/places";
import { estimatedGameEnd } from "@/lib/game-day";
import { homeWarnings, routeHome, RouteHomeError } from "@/lib/route-home";
import { PRIVATE_HEADERS, jsonError } from "@/lib/plan-crew-api";

// GET /api/plans/[id]/home -> your route home after the game (never stored).
// Starts from the stadium, or from your last after-game stop an hour after
// you get there, and ends at your own starting point.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError("Please sign in.", 401);
  if (!UUID_PATTERN.test(id)) return jsonError("Plan not found.", 404);

  const plan = await loadPlanForViewer(supabase, id, authData.user.id);
  if (plan === "error") return jsonError("We couldn’t load this plan. Please try again.", 500);
  if (!plan) return jsonError("Plan not found.", 404);
  if (!plan.game.startsAt || !plan.game.venue) return jsonError("This game is missing its time or venue.", 400);

  const { data: me } = await supabase
    .from("plan_members")
    .select("origin,origin_lat,origin_lng,travel_mode")
    .eq("plan_id", id)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  const start = me as { origin: string | null; origin_lat: number | null; origin_lng: number | null; travel_mode: "TRANSIT" | "DRIVE" | null } | null;
  if (!start?.origin) return jsonError("Add your starting point first, so we know where home is.", 400);
  const home = typeof start.origin_lat === "number" && typeof start.origin_lng === "number"
    ? { lat: start.origin_lat, lng: start.origin_lng }
    : { address: start.origin };
  const mode = start.travel_mode ?? plan.travelMode;

  // Leave from the last after-game stop (an hour after you get there), else the stadium at the final whistle.
  const venue = plan.game.venue;
  const gameEnd = Date.parse(estimatedGameEnd({ game: { startsAt: plan.game.startsAt, venue: { name: venue.name ?? "" } } } as never));
  const afterStops = savedStops(plan.itinerary).filter(stop => stop.slot === "after").sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  let from: { lat: number; lng: number } | { address: string } | null = venueLocation(venue);
  let fromName = venue.name ?? "the stadium";
  let leaveAt = gameEnd;
  const lastStop = afterStops.at(-1);
  if (lastStop) {
    const [detailed] = await withPlaceDetails([lastStop], venue);
    if (detailed.place?.location) {
      from = detailed.place.location;
      fromName = detailed.place.name;
      leaveAt = Math.max(gameEnd, Date.parse(lastStop.time) + 60 * 60_000);
    }
  }
  if (!from) from = { address: [venue.name, venue.address].filter(Boolean).join(", ") };

  try {
    const route = await routeHome(from, home, mode, leaveAt);
    return NextResponse.json({
      from: { name: fromName, kind: lastStop ? "stop" : "stadium" },
      to: { name: start.origin },
      travelMode: mode,
      plannedLeaveAt: new Date(leaveAt).toISOString(),
      route,
      warnings: homeWarnings(route, mode, leaveAt),
    }, { headers: PRIVATE_HEADERS });
  } catch (caught) {
    return jsonError(caught instanceof RouteHomeError ? caught.message : "Routes are temporarily unavailable. Please try again.", 502);
  }
}
