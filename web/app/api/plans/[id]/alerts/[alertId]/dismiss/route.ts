import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/plan-access";
import { jsonError, liveContext, PRIVATE_HEADERS } from "@/lib/live";

// POST /api/plans/[id]/alerts/[alertId]/dismiss -> { dismissed: true }. Late person only.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; alertId: string }> },
) {
  const { id, alertId } = await params;
  const ctx = await liveContext(await createClient(), id);
  if (ctx instanceof NextResponse) return ctx;
  if (!UUID_PATTERN.test(alertId)) return jsonError("Alert not found.", 404);

  const { data: alert, error } = await ctx.supabase
    .from("plan_alerts")
    .select("id,user_id")
    .eq("id", alertId)
    .eq("plan_id", id)
    .maybeSingle();
  if (error) return jsonError("We couldn’t dismiss this alert. Please try again.", 500);
  if (!alert) return jsonError("Alert not found.", 404);
  if (alert.user_id !== ctx.userId) {
    return jsonError("Only the person running late can dismiss this.", 403);
  }

  const { error: updateError } = await ctx.supabase
    .from("plan_alerts")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", alertId);
  if (updateError) return jsonError("We couldn’t dismiss this alert. Please try again.", 500);

  return NextResponse.json({ dismissed: true }, { headers: PRIVATE_HEADERS });
}
