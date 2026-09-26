import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toIsoTimestamp } from "@/lib/saved-plan-api";
import { PLACE_ID_PATTERN, PRIVATE_HEADERS, UUID_PATTERN, jsonError, rpcError } from "@/lib/plan-crew-api";

// POST /api/plans/[id]/stop-suggestions  { placeId, slot, time }
// Co-leaders and members suggest a stop; the leader approves or declines it.
// The database checks the same time rules as stops.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (typeof body.placeId !== "string" || !PLACE_ID_PATTERN.test(body.placeId)) return jsonError("That spot isn’t valid.", 400);
  if (body.slot !== "before" && body.slot !== "after") return jsonError('slot must be "before" or "after".', 400);
  let time: string;
  try {
    time = toIsoTimestamp(body.time, "time");
  } catch (caught) {
    return jsonError(caught instanceof Error ? caught.message : "That time isn’t valid.", 400);
  }

  const { data, error } = await supabase.rpc("suggest_stop", {
    p_plan_id: id,
    p_place_id: body.placeId,
    p_slot: body.slot,
    p_time: time,
  });
  if (error) return rpcError(error, "We couldn’t send your suggestion. Please try again.");
  return NextResponse.json({ suggestion: { id: data, status: "pending" } }, { status: 201, headers: PRIVATE_HEADERS });
}
