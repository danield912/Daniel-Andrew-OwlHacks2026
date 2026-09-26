import { NextResponse } from "next/server";
import {
  INVITE_ERRORS,
  INVITE_TOKEN_PATTERN,
  PRIVATE_HEADERS,
  jsonError,
  rpcErrorResponse,
  type AcceptInviteResponse,
} from "@/lib/plan-invites-api";
import { createClient } from "@/lib/supabase/server";

// Joins the plan as a member. Already being a member is not an error: the
// response is the same, with joined: false, and the role is unchanged.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError(INVITE_ERRORS.signIn, 401);
  if (!INVITE_TOKEN_PATTERN.test(token)) return jsonError(INVITE_ERRORS.notFound, 404);

  const { data, error } = await supabase.rpc("accept_plan_invite", { p_token: token });
  if (error) return rpcErrorResponse(error, "We couldn’t join this plan. Please try again.");

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.plan_id) return jsonError("We couldn’t join this plan. Please try again.", 500);

  const body: AcceptInviteResponse = {
    plan: { id: row.plan_id },
    joined: !row.already_member,
  };
  return NextResponse.json(body, { headers: PRIVATE_HEADERS });
}
