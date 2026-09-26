import { NextResponse } from "next/server";
import {
  PLAN_ERRORS,
  PRIVATE_HEADERS,
  jsonError,
  type LeavePlanResponse,
} from "@/lib/plan-invites-api";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Removes only the signed-in user from the plan. The leader can't leave.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError(PLAN_ERRORS.signIn, 401);
  if (!UUID_PATTERN.test(id)) return jsonError(PLAN_ERRORS.notFound, 404);

  const { error } = await supabase.rpc("leave_plan", { p_plan_id: id });
  if (error?.code === "28000") return jsonError(PLAN_ERRORS.signIn, 401);
  if (error?.code === "P0002") return jsonError(PLAN_ERRORS.notFound, 404);
  if (error?.code === "GP400") return jsonError(PLAN_ERRORS.leaderCannotLeave, 400);
  if (error) return jsonError("We couldn’t leave this plan. Please try again.", 500);

  const body: LeavePlanResponse = { left: true };
  return NextResponse.json(body, { headers: PRIVATE_HEADERS });
}
