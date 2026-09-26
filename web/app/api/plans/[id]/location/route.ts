import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  autoLateCheck,
  jsonError,
  liveContext,
  PRIVATE_HEADERS,
  windowClosedMessage,
} from "@/lib/live";

type Params = { params: Promise<{ id: string }> };

// PUT /api/plans/[id]/location  { lat, lng, accuracy } -> { sharing: true, expiresAt }
// Overwrites your single location row. 403 outside the game-day window.
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await liveContext(await createClient(), id);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.window.isOpen) return jsonError(windowClosedMessage(ctx.window), 403);

  let body: { lat?: unknown; lng?: unknown; accuracy?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Send { lat, lng, accuracy }.", 400);
  }
  const { lat, lng, accuracy } = body ?? {};
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return jsonError("lat and lng must be valid coordinates.", 400);
  }
  if (accuracy !== undefined && accuracy !== null &&
      (typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100_000)) {
    return jsonError("accuracy must be a number of meters.", 400);
  }

  const { error } = await ctx.supabase.from("plan_locations").upsert(
    { plan_id: id, user_id: ctx.userId, lat, lng, accuracy: accuracy ?? null },
    { onConflict: "plan_id,user_id" },
  );
  if (error) {
    // RLS rejects writes if the window closed between the check and the write.
    if (error.code === "42501") return jsonError(windowClosedMessage(ctx.window), 403);
    return jsonError("We couldn’t share your location. Please try again.", 500);
  }

  await autoLateCheck(ctx, { lat, lng });

  return NextResponse.json(
    { sharing: true, expiresAt: ctx.window.endsAt },
    { headers: PRIVATE_HEADERS },
  );
}

// DELETE /api/plans/[id]/location -> { sharing: false }. Deletes your row right away.
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await liveContext(await createClient(), id);
  if (ctx instanceof NextResponse) return ctx;

  const { error } = await ctx.supabase
    .from("plan_locations")
    .delete()
    .eq("plan_id", id)
    .eq("user_id", ctx.userId);
  if (error) return jsonError("We couldn’t stop sharing. Please try again.", 500);

  return NextResponse.json({ sharing: false }, { headers: PRIVATE_HEADERS });
}
