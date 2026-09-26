import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/places";
import { parseRouteSnapshot, toIsoTimestamp } from "@/lib/saved-plan-api";
import { PRIVATE_HEADERS, UUID_PATTERN, jsonError, rpcError } from "@/lib/plan-crew-api";

// PUT /api/plans/[id]/start  { origin, travelMode, route?, routeCalculatedAt? }
// Saves where the signed-in person is coming from. The address is looked up
// on the map so the crew can see everyone's starting point.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError("Please sign in.", 401);
  if (!UUID_PATTERN.test(id)) return jsonError("Plan not found.", 404);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Send a JSON request body.", 400);
  }

  const origin = typeof body.origin === "string" ? body.origin.trim() : "";
  if (origin.length < 2 || origin.length > 200) return jsonError("Enter a starting address (2–200 characters).", 400);
  if (body.travelMode !== "TRANSIT" && body.travelMode !== "DRIVE") return jsonError("travelMode must be TRANSIT or DRIVE.", 400);

  let route = null;
  let routeCalculatedAt: string | null = null;
  if (body.route != null) {
    try {
      route = parseRouteSnapshot(body.route);
      routeCalculatedAt = toIsoTimestamp(body.routeCalculatedAt ?? new Date().toISOString(), "routeCalculatedAt");
    } catch (caught) {
      return jsonError(caught instanceof Error ? caught.message : "The route isn’t valid.", 400);
    }
  }

  // Put the address on the map. If Google is down, still save the address
  // so leave times keep working; the pin appears after the next update.
  let location: { lat: number; lng: number } | null = null;
  let warning: string | undefined;
  try {
    const found = await geocodeAddress(origin);
    if (!found) return jsonError("We couldn’t find that address on the map. Try adding the city or ZIP code.", 400);
    location = found.location;
  } catch {
    warning = "Saved, but we couldn’t put it on the map right now. Try again later to show your pin.";
  }

  const { error } = await supabase.rpc("set_my_start", {
    p_plan_id: id,
    p_origin: origin,
    p_lat: location?.lat ?? null,
    p_lng: location?.lng ?? null,
    p_travel_mode: body.travelMode,
    p_route: route,
    p_route_calculated_at: routeCalculatedAt,
  });
  if (error) return rpcError(error, "We couldn’t save your starting point. Please try again.");

  return NextResponse.json({
    start: { origin, location, travelMode: body.travelMode, route, routeCalculatedAt },
    ...(warning ? { warning } : {}),
  }, { headers: PRIVATE_HEADERS });
}
