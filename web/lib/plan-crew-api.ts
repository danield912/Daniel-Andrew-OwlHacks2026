// Server helpers for crew starting points, roles, and stop suggestions.
import { NextResponse } from "next/server";
import type { MemberStart, PlanMember } from "@/lib/plan-invites-api";

export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{1,300}$/;

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: PRIVATE_HEADERS });
}

// Maps database error codes (see the crew migration) to API responses. The
// database messages are written for people, so they're passed through.
export function rpcError(error: { code?: string; message?: string } | null, fallback: string) {
  switch (error?.code) {
    case "28000": return jsonError("Please sign in.", 401);
    case "P0002": return jsonError(error.message || "Plan not found.", 404);
    case "42501": return jsonError(error.message || "You don’t have permission to do that.", 403);
    case "22023": return jsonError(error.message || "That request isn’t valid.", 400);
    default:
      if (error) console.error(fallback, error.code, error.message);
      return jsonError(fallback, 500);
  }
}

export type MemberRow = {
  user_id: string;
  name: string;
  role: PlanMember["role"];
  origin?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  travel_mode?: "TRANSIT" | "DRIVE" | null;
  route_snapshot?: Record<string, unknown> | null;
  route_calculated_at?: string | null;
};

export function serializeMember(row: MemberRow, viewerId: string): PlanMember {
  const start: MemberStart | null = row.origin && row.travel_mode ? {
    origin: row.origin,
    location: typeof row.origin_lat === "number" && typeof row.origin_lng === "number"
      ? { lat: row.origin_lat, lng: row.origin_lng }
      : null,
    travelMode: row.travel_mode,
    route: row.route_snapshot ?? null,
    routeCalculatedAt: row.route_calculated_at ?? null,
  } : null;
  return { userId: row.user_id, name: row.name, role: row.role, isYou: row.user_id === viewerId, start };
}

export type SuggestionRow = {
  id: string;
  place_id: string;
  slot: "before" | "after";
  stop_time: string;
  status: "pending" | "approved" | "declined";
  suggested_by: string;
  suggested_by_name: string;
  created_at: string;
};
