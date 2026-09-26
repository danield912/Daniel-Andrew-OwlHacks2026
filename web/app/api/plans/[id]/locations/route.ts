import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, liveContext, memberNames, PRIVATE_HEADERS } from "@/lib/live";

type LocationRow = {
  user_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  updated_at: string;
};

// GET /api/plans/[id]/locations
// -> { locations: [{ userId, name, lat, lng, accuracy, updatedAt, isYou }], window: { startsAt, endsAt } }
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await liveContext(await createClient(), id);
  if (ctx instanceof NextResponse) return ctx;

  const { data, error } = await ctx.supabase
    .from("plan_locations")
    .select("user_id,lat,lng,accuracy,updated_at")
    .eq("plan_id", id)
    .order("updated_at", { ascending: false });
  if (error) return jsonError("We couldn’t load locations. Please try again.", 500);

  const names = await memberNames(ctx.supabase, id);
  const locations = ((data ?? []) as LocationRow[]).map((row) => ({
    userId: row.user_id,
    name: names.get(row.user_id) ?? "Someone",
    lat: row.lat,
    lng: row.lng,
    accuracy: row.accuracy,
    updatedAt: new Date(row.updated_at).toISOString(),
    isYou: row.user_id === ctx.userId,
  }));

  return NextResponse.json(
    { locations, window: { startsAt: ctx.window.startsAt, endsAt: ctx.window.endsAt } },
    { headers: PRIVATE_HEADERS },
  );
}
