import { NextResponse } from "next/server";
import { serializeSavedPlan, type SavedPlanRow } from "@/lib/saved-plan-api";
import {
  PLAN_ERRORS,
  type DeletePlanResponse,
  type PlanMember,
} from "@/lib/plan-invites-api";
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

  // Names and roles only; get_plan_members returns nothing to non-members.
  const { data: memberRows, error: membersError } = await supabase.rpc(
    "get_plan_members",
    { p_plan_id: id },
  );
  // A members lookup problem (e.g. the invites migration not applied yet)
  // must not block opening the plan itself.
  if (membersError) console.error("get_plan_members failed:", membersError.message);
  type MemberRow = { user_id: string; name: string; role: PlanMember["role"] };
  const members: PlanMember[] = (membersError ? [] : (memberRows as MemberRow[] | null) ?? []).map(
    (member) => ({
      userId: member.user_id,
      name: member.name,
      role: member.role,
      isYou: member.user_id === user.id,
    }),
  );

  try {
    return NextResponse.json(
      { plan: { ...serializeSavedPlan(data as unknown as SavedPlanRow, user.id), members } },
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
