import { NextResponse } from "next/server";
import { serializeSavedPlan, type SavedPlanRow } from "@/lib/saved-plan-api";
import { createClient } from "@/lib/supabase/server";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PLAN_SELECT = [
  "id",
  "title",
  "game_id",
  "game",
  "origin",
  "travel_mode",
  "target_arrival_time",
  "preferences",
  "itinerary",
  "route_snapshot",
  "route_calculated_at",
  "created_at",
  "plan_members!inner(user_id,role)",
].join(",");

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: PRIVATE_HEADERS });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authError ? null : authData.user;
  if (!user) return jsonError("Please sign in.", 401);
  if (!UUID_PATTERN.test(id)) return jsonError("Plan not found.", 404);

  const { data, error } = await supabase
    .from("plans")
    .select(PLAN_SELECT)
    .eq("id", id)
    .eq("plan_members.user_id", user.id)
    .maybeSingle();

  if (error) return jsonError("We couldn’t load this plan. Please try again.", 500);
  if (!data) return jsonError("Plan not found.", 404);

  try {
    return NextResponse.json(
      { plan: serializeSavedPlan(data as unknown as SavedPlanRow, user.id) },
      { headers: PRIVATE_HEADERS },
    );
  } catch {
    // Do not disclose whether a malformed or inaccessible plan exists.
    return jsonError("Plan not found.", 404);
  }
}
