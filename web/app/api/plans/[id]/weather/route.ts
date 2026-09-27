import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadPlanForViewer, UUID_PATTERN } from "@/lib/plan-access";
import { gameWeather } from "@/lib/weather";
import { PRIVATE_HEADERS, jsonError } from "@/lib/plan-crew-api";

// GET /api/plans/[id]/weather -> forecast at the stadium for arrival, kickoff,
// and mid-game. { available: false, reason } until about 6 days out.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError("Please sign in.", 401);
  if (!UUID_PATTERN.test(id)) return jsonError("Plan not found.", 404);

  const plan = await loadPlanForViewer(supabase, id, authData.user.id);
  if (plan === "error") return jsonError("We couldn’t load this plan. Please try again.", 500);
  if (!plan) return jsonError("Plan not found.", 404);

  const venue = plan.game.venue;
  const kickoff = plan.game.startsAt;
  if (typeof venue?.latitude !== "number" || typeof venue?.longitude !== "number" || !kickoff) {
    return NextResponse.json({ available: false, reason: "No forecast for this venue." }, { headers: PRIVATE_HEADERS });
  }
  const weather = await gameWeather(venue.latitude, venue.longitude, [
    { at: plan.targetArrivalTime, label: "Arrive" },
    { at: kickoff, label: "Kickoff" },
    { at: new Date(Date.parse(kickoff) + 2 * 60 * 60_000).toISOString(), label: "Mid-game" },
  ]);
  return NextResponse.json(weather, { headers: PRIVATE_HEADERS });
}
