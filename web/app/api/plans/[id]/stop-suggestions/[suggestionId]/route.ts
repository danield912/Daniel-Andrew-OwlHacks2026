import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { savedStops, withPlaceDetails, type PlanVenue } from "@/lib/places";
import { PRIVATE_HEADERS, UUID_PATTERN, jsonError, rpcError } from "@/lib/plan-crew-api";

type Params = { params: Promise<{ id: string; suggestionId: string }> };

// PATCH  { decision: "approve" | "decline" } — leader only. Approving adds the
// stop to the plan. Returns the plan's updated stops.
export async function PATCH(request: Request, { params }: Params) {
  const { id, suggestionId } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError("Please sign in.", 401);
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(suggestionId)) return jsonError("Suggestion not found.", 404);

  let decision: unknown;
  try {
    decision = ((await request.json()) as { decision?: unknown }).decision;
  } catch {
    return jsonError("Send a JSON request body.", 400);
  }
  if (decision !== "approve" && decision !== "decline") return jsonError('decision must be "approve" or "decline".', 400);

  const { data: planId, error } = await supabase.rpc("review_stop_suggestion", {
    p_suggestion_id: suggestionId,
    p_approve: decision === "approve",
  });
  if (error) return rpcError(error, "We couldn’t update that suggestion. Please try again.");
  if (planId !== id) return jsonError("Suggestion not found.", 404);

  const { data: plan } = await supabase.from("plans").select("game,itinerary").eq("id", id).maybeSingle();
  const saved = savedStops(plan?.itinerary);
  const venue = (plan?.game as { venue?: PlanVenue } | undefined)?.venue;
  const stops = saved.length && venue ? await withPlaceDetails(saved, venue) : saved.map((stop) => ({ ...stop, place: null }));
  return NextResponse.json({ suggestion: { id: suggestionId, status: decision === "approve" ? "approved" : "declined" }, stops }, { headers: PRIVATE_HEADERS });
}

// DELETE — the person who suggested it withdraws it while it's still waiting.
export async function DELETE(_request: Request, { params }: Params) {
  const { id, suggestionId } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError("Please sign in.", 401);
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(suggestionId)) return jsonError("Suggestion not found.", 404);

  const { error } = await supabase.rpc("withdraw_stop_suggestion", { p_suggestion_id: suggestionId });
  if (error) return rpcError(error, "We couldn’t withdraw that suggestion. Please try again.");
  return NextResponse.json({ withdrawn: true }, { headers: PRIVATE_HEADERS });
}
