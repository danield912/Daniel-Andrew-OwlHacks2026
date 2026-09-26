import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PRIVATE_HEADERS, UUID_PATTERN, jsonError, rpcError } from "@/lib/plan-crew-api";

type Params = { params: Promise<{ id: string; userId: string }> };

async function signedIn() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : data.user };
}

// PATCH /api/plans/[id]/members/[userId]  { role: "co_leader" | "member" }
// Leader only: promote someone to co-leader or move them back to member.
export async function PATCH(request: Request, { params }: Params) {
  const { id, userId } = await params;
  const { supabase, user } = await signedIn();
  if (!user) return jsonError("Please sign in.", 401);
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(userId)) return jsonError("Plan not found.", 404);

  let role: unknown;
  try {
    role = ((await request.json()) as { role?: unknown }).role;
  } catch {
    return jsonError("Send a JSON request body.", 400);
  }
  if (role !== "co_leader" && role !== "member") return jsonError("Role must be co-leader or member.", 400);

  const { error } = await supabase.rpc("set_member_role", { p_plan_id: id, p_user_id: userId, p_role: role });
  if (error) return rpcError(error, "We couldn’t change that role. Please try again.");
  return NextResponse.json({ member: { userId, role } }, { headers: PRIVATE_HEADERS });
}

// DELETE /api/plans/[id]/members/[userId] — leader only: remove someone.
export async function DELETE(_request: Request, { params }: Params) {
  const { id, userId } = await params;
  const { supabase, user } = await signedIn();
  if (!user) return jsonError("Please sign in.", 401);
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(userId)) return jsonError("Plan not found.", 404);

  const { error } = await supabase.rpc("remove_member", { p_plan_id: id, p_user_id: userId });
  if (error) return rpcError(error, "We couldn’t remove them. Please try again.");
  return NextResponse.json({ removed: true }, { headers: PRIVATE_HEADERS });
}
