import { NextRequest, NextResponse } from "next/server";
import {
  INVITE_ERRORS,
  PRIVATE_HEADERS,
  jsonError,
  rpcErrorResponse,
} from "@/lib/plan-invites-api";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Leader or co-leader creates a 7-day invite link.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError(INVITE_ERRORS.signIn, 401);
  if (!UUID_PATTERN.test(id)) return jsonError(INVITE_ERRORS.planNotFound, 404);

  const { data, error } = await supabase.rpc("create_plan_invite", { p_plan_id: id });
  if (error?.code === "P0002") return jsonError(INVITE_ERRORS.planNotFound, 404);
  if (error) return rpcErrorResponse(error, "We couldn’t create an invite link. Please try again.");

  const invite = Array.isArray(data) ? data[0] : data;
  if (!invite?.token) {
    return jsonError("We couldn’t create an invite link. Please try again.", 500);
  }

  return NextResponse.json(
    {
      invite: {
        token: invite.token,
        url: new URL(`/invite/${invite.token}`, request.nextUrl.origin).toString(),
        expiresAt: new Date(invite.expires_at).toISOString(),
      },
    },
    { status: 201, headers: PRIVATE_HEADERS },
  );
}
