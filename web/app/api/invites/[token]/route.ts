import { NextResponse } from "next/server";
import {
  INVITE_ERRORS,
  INVITE_TOKEN_PATTERN,
  PRIVATE_HEADERS,
  jsonError,
  type InvitePreview,
} from "@/lib/plan-invites-api";
import { createClient } from "@/lib/supabase/server";

// Public preview: works signed out. Returns only the game, venue and the
// inviter's display name, never the plan's origin, itinerary, route or members.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!INVITE_TOKEN_PATTERN.test(token)) return jsonError(INVITE_ERRORS.notFound, 404);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invite_preview", { p_token: token });
  if (error) return jsonError("We couldn’t load this invite. Please try again.", 500);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return jsonError(INVITE_ERRORS.notFound, 404);
  if (row.status === "expired") return jsonError(INVITE_ERRORS.expired, 410);

  const invite: InvitePreview = {
    planId: row.plan_id,
    planTitle: row.title,
    invitedBy: row.invited_by,
    expiresAt: new Date(row.expires_at).toISOString(),
    alreadyMember: Boolean(row.already_member),
    game: {
      name: row.game?.name,
      startsAt: row.game?.startsAt,
      venue: { name: row.game?.venue?.name },
    },
  };

  return NextResponse.json({ invite }, { headers: PRIVATE_HEADERS });
}
