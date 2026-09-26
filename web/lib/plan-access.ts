import type { createClient } from "@/lib/supabase/server";
import type { PlanVenue } from "@/lib/places";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PlanForViewer = {
  id: string;
  role: "leader" | "co_leader" | "member";
  game: { startsAt?: string; venue?: PlanVenue };
  preferences: Record<string, unknown>;
  targetArrivalTime: string;
  travelMode: "TRANSIT" | "DRIVE";
  itinerary: Record<string, unknown>;
};

type Row = {
  id: string;
  game: PlanForViewer["game"];
  preferences: Record<string, unknown> | null;
  target_arrival_time: string;
  travel_mode: "TRANSIT" | "DRIVE";
  itinerary: Record<string, unknown> | null;
  plan_members: Array<{ user_id: string; role: PlanForViewer["role"] }>;
};

// Loads a plan only if the signed-in user is a member (RLS enforces the same).
// Returns null for missing or inaccessible plans so callers can answer 404.
export async function loadPlanForViewer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
  userId: string,
): Promise<PlanForViewer | null | "error"> {
  const { data, error } = await supabase
    .from("plans")
    .select("id,game,preferences,target_arrival_time,travel_mode,itinerary,plan_members!inner(user_id,role)")
    .eq("id", planId)
    .eq("plan_members.user_id", userId)
    .maybeSingle();
  if (error) return "error";
  const row = data as unknown as Row | null;
  const role = row?.plan_members?.find((member) => member.user_id === userId)?.role;
  if (!row || !role) return null;
  return {
    id: row.id,
    role,
    game: row.game ?? {},
    preferences: row.preferences ?? {},
    targetArrivalTime: row.target_arrival_time,
    travelMode: row.travel_mode,
    itinerary: row.itinerary ?? {},
  };
}
