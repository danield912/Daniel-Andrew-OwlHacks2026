import { NextResponse } from "next/server";
import { PRIVATE_HEADERS, jsonError } from "@/lib/plan-invites-api";
import { loadPlanForViewer, UUID_PATTERN } from "@/lib/plan-access";
import { parseStops, PlacesError, withPlaceDetails, type PlanStop } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";

const NOT_ALLOWED = "Only the plan leader or co-leader can change stops.";

// PUT /api/plans/[id]/stops  body { stops: [{ placeId, slot, time }] }
// Replaces all stops. -> 200 { stops: PlanStop[] } (same shape as GET /api/plans/[id]).
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError("Please sign in.", 401);
  if (!UUID_PATTERN.test(id)) return jsonError("Plan not found.", 404);

  const plan = await loadPlanForViewer(supabase, id, authData.user.id);
  if (plan === "error") return jsonError("We couldn’t load this plan. Please try again.", 500);
  if (!plan) return jsonError("Plan not found.", 404);
  if (plan.role === "member") return jsonError(NOT_ALLOWED, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Send a JSON request body.", 400);
  }

  let stops;
  try {
    stops = parseStops(body, {
      targetArrivalTime: plan.targetArrivalTime,
      gameStartsAt: plan.game.startsAt,
    });
  } catch (caught) {
    if (caught instanceof PlacesError) return jsonError(caught.message, caught.status);
    throw caught;
  }

  // The database re-checks role and rules, so the browser can't bypass them.
  const { error } = await supabase.rpc("set_plan_stops", { p_plan_id: id, p_stops: stops });
  if (error?.code === "28000") return jsonError("Please sign in.", 401);
  if (error?.code === "P0002") return jsonError("Plan not found.", 404);
  if (error?.code === "42501") return jsonError(NOT_ALLOWED, 403);
  if (error?.code === "22023") return jsonError(error.message, 400);
  if (error) return jsonError("We couldn’t save these stops. Please try again.", 500);

  const withDetails: PlanStop[] = plan.game.venue
    ? await withPlaceDetails(stops, plan.game.venue)
    : stops.map((stop) => ({ ...stop, place: null }));
  return NextResponse.json({ stops: withDetails }, { headers: PRIVATE_HEADERS });
}
