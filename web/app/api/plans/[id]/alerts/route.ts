import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ALERT_COLUMNS,
  jsonError,
  liveContext,
  nextTarget,
  PRIVATE_HEADERS,
  serializeAlerts,
  windowClosedMessage,
  type AlertRow,
  type StoredTarget,
} from "@/lib/live";

type Params = { params: Promise<{ id: string }> };

// POST /api/plans/[id]/alerts  { minutesLate: 5 | 15 | 30, note? } -> 201 { alert }
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await liveContext(await createClient(), id);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.window.isOpen) return jsonError(windowClosedMessage(ctx.window), 403);

  let body: { minutesLate?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Send { minutesLate, note }.", 400);
  }
  if (body?.minutesLate !== 5 && body?.minutesLate !== 15 && body?.minutesLate !== 30) {
    return jsonError("minutesLate must be 5, 15, or 30.", 400);
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") {
    return jsonError("note must be text.", 400);
  }
  if (note.length > 140) return jsonError("Keep the note under 140 characters.", 400);

  const target = await nextTarget(ctx.plan);
  const stored: StoredTarget | null = target
    ? { kind: target.kind, at: target.at, placeId: target.placeId }
    : null;

  const { data, error } = await ctx.supabase
    .from("plan_alerts")
    .insert({
      plan_id: id,
      user_id: ctx.userId,
      kind: "manual",
      minutes_late: body.minutesLate,
      target: stored,
      eta: stored ? new Date(Date.parse(stored.at) + body.minutesLate * 60_000).toISOString() : null,
      note: note || null,
    })
    .select(ALERT_COLUMNS)
    .single();
  if (error?.code === "42501") return jsonError(windowClosedMessage(ctx.window), 403);
  if (error || !data) return jsonError("We couldn’t send your alert. Please try again.", 500);

  const [alert] = await serializeAlerts([data as AlertRow], ctx);
  return NextResponse.json({ alert }, { status: 201, headers: PRIVATE_HEADERS });
}

// GET /api/plans/[id]/alerts?since=ISO -> { alerts: [...] }, newest first.
// Alerts you dismissed are hidden from you; the rest of the crew still sees them.
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await liveContext(await createClient(), id);
  if (ctx instanceof NextResponse) return ctx;

  const since = new URL(request.url).searchParams.get("since");
  if (since !== null && !Number.isFinite(Date.parse(since))) {
    return jsonError("since must be an ISO 8601 timestamp.", 400);
  }

  let query = ctx.supabase
    .from("plan_alerts")
    .select(`${ALERT_COLUMNS},dismissed_at`)
    .eq("plan_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (since) query = query.gt("created_at", new Date(since).toISOString());

  const { data, error } = await query;
  if (error) return jsonError("We couldn’t load alerts. Please try again.", 500);

  const rows = ((data ?? []) as Array<AlertRow & { dismissed_at: string | null }>)
    .filter((row) => !(row.user_id === ctx.userId && row.dismissed_at));
  const alerts = await serializeAlerts(rows, ctx);
  return NextResponse.json({ alerts }, { headers: PRIVATE_HEADERS });
}
