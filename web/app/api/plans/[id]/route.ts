import { NextResponse } from "next/server";
import { serializeSavedPlan, type SavedPlanRow } from "@/lib/saved-plan-api";
import {
  PLAN_ERRORS,
  type DeletePlanResponse,
  type PlanMember,
} from "@/lib/plan-invites-api";
import { savedStops, withPlaceDetails, type PlanVenue, type PlanStop } from "@/lib/places";
import { serializeMember, type MemberRow, type SuggestionRow } from "@/lib/plan-crew-api";
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

  // Names, roles and starting points; get_plan_members returns nothing to non-members.
  const [membersResult, suggestionsResult] = await Promise.all([
    supabase.rpc("get_plan_members", { p_plan_id: id }),
    supabase.rpc("get_stop_suggestions", { p_plan_id: id }),
  ]);
  // A lookup problem (e.g. a migration not applied yet) must not block
  // opening the plan itself.
  if (membersResult.error) console.error("get_plan_members failed:", membersResult.error.message);
  if (suggestionsResult.error) console.error("get_stop_suggestions failed:", suggestionsResult.error.message);
  const members: PlanMember[] = ((membersResult.error ? [] : membersResult.data) as MemberRow[] | null ?? [])
    .map((member) => serializeMember(member, user.id));
  const suggestionRows = (suggestionsResult.error ? [] : suggestionsResult.data) as SuggestionRow[] | null ?? [];

  // Stops and suggestions store only Google place IDs; names and addresses
  // are fetched fresh, in one batch.
  const row = data as unknown as SavedPlanRow & { game?: { venue?: PlanVenue } };
  const saved = savedStops(row.itinerary);
  const suggested = suggestionRows.map((s) => ({ placeId: s.place_id, slot: s.slot, time: s.stop_time }));
  const venue = row.game?.venue;
  const detailed: PlanStop[] = (saved.length || suggested.length) && venue
    ? await withPlaceDetails([...saved, ...suggested], venue)
    : [...saved, ...suggested].map((stop) => ({ ...stop, place: null }));
  const stops = detailed.slice(0, saved.length);
  const suggestions = suggestionRows.map((s, index) => ({
    id: s.id,
    placeId: s.place_id,
    slot: s.slot,
    time: new Date(s.stop_time).toISOString(),
    status: s.status,
    createdAt: s.created_at,
    suggestedBy: { userId: s.suggested_by, name: s.suggested_by_name, isYou: s.suggested_by === user.id },
    place: detailed[saved.length + index]?.place ?? null,
  }));

  try {
    return NextResponse.json(
      { plan: { ...serializeSavedPlan(row, user.id), members, stops, suggestions } },
      { headers: PRIVATE_HEADERS },
    );
  } catch {
    // Do not disclose whether a malformed or inaccessible plan exists.
    return jsonError("Plan not found.", 404);
  }
}

// Leader only. Deleting the plan also deletes its members and invite links
// (database cascade), so old plan and invite links then return 404.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError(PLAN_ERRORS.signIn, 401);
  if (!UUID_PATTERN.test(id)) return jsonError(PLAN_ERRORS.notFound, 404);

  const { error } = await supabase.rpc("delete_plan", { p_plan_id: id });
  if (error?.code === "28000") return jsonError(PLAN_ERRORS.signIn, 401);
  if (error?.code === "P0002") return jsonError(PLAN_ERRORS.notFound, 404);
  if (error?.code === "42501") return jsonError(PLAN_ERRORS.notLeaderDelete, 403);
  if (error) return jsonError("We couldn’t delete this plan. Please try again.", 500);

  const body: DeletePlanResponse = { deleted: true };
  return NextResponse.json(body, { headers: PRIVATE_HEADERS });
}
