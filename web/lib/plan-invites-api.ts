import { NextResponse } from "next/server";

export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

// Tokens are 64 lowercase hex characters (see create_plan_invite).
export const INVITE_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export const INVITE_ERRORS = {
  signIn: "Please sign in.",
  planNotFound: "Plan not found.",
  notLeader: "Only the plan leader can invite friends.",
  notFound: "This invite link isn't valid.",
  expired: "This invite link has expired. Ask the plan leader for a new one.",
} as const;

// These mirror PlanMember and InvitePreview in Daniel's lib/saved-plans.ts
// (the frontend contract). Keep the field names identical.
export type PlanMember = {
  userId: string;
  name: string;
  role: "leader" | "co_leader" | "member";
  isYou: boolean;
  // Where this person is coming from (null until they add it).
  start?: MemberStart | null;
};

export type MemberStart = {
  origin: string;
  location: { lat: number; lng: number } | null;
  travelMode: "TRANSIT" | "DRIVE";
  route: Record<string, unknown> | null;
  routeCalculatedAt: string | null;
};

export type InvitePreview = {
  planId: string;
  planTitle: string;
  invitedBy: string;
  expiresAt: string;
  alreadyMember: boolean;
  game: {
    name: string;
    startsAt: string;
    venue: { name: string };
  };
};

export type AcceptInviteResponse = {
  plan: { id: string };
  // false when the viewer was already a member (nothing changed).
  joined: boolean;
};

// DELETE /api/plans/[id] -> 200 { deleted: true }
export type DeletePlanResponse = { deleted: true };
// POST /api/plans/[id]/leave -> 200 { left: true }
export type LeavePlanResponse = { left: true };

export const PLAN_ERRORS = {
  signIn: "Please sign in.",
  notFound: "Plan not found.",
  notLeaderDelete: "Only the plan leader can delete this plan.",
  leaderCannotLeave: "Delete the plan instead",
} as const;

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: PRIVATE_HEADERS });
}

// Maps errors raised by the invite RPCs to API responses.
export function rpcErrorResponse(error: { code?: string } | null, fallback: string) {
  switch (error?.code) {
    case "28000":
      return jsonError(INVITE_ERRORS.signIn, 401);
    case "P0002":
      return jsonError(INVITE_ERRORS.notFound, 404);
    case "22023":
      return jsonError(INVITE_ERRORS.expired, 410);
    case "42501":
      return jsonError(INVITE_ERRORS.notLeader, 403);
    default:
      return jsonError(fallback, 500);
  }
}
