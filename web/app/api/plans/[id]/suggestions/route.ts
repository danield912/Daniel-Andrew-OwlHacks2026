import { NextRequest, NextResponse } from "next/server";
import { PRIVATE_HEADERS, jsonError } from "@/lib/plan-invites-api";
import { loadPlanForViewer, UUID_PATTERN } from "@/lib/plan-access";
import { PlacesError, suggestPlaces, type SuggestedPlace } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";

// GET /api/plans/[id]/suggestions?slot=before|after
// -> 200 { places: SuggestedPlace[] }. Any member may view suggestions.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError("Please sign in.", 401);
  if (!UUID_PATTERN.test(id)) return jsonError("Plan not found.", 404);

  const slot = request.nextUrl.searchParams.get("slot");
  if (slot !== "before" && slot !== "after") {
    return jsonError('slot must be "before" or "after".', 400);
  }

  const plan = await loadPlanForViewer(supabase, id, authData.user.id);
  if (plan === "error") return jsonError("We couldn’t load this plan. Please try again.", 500);
  if (!plan?.game.venue) return jsonError("Plan not found.", 404);

  try {
    const places: SuggestedPlace[] = await suggestPlaces({
      slot,
      venue: plan.game.venue,
      preferences: plan.preferences,
    });
    return NextResponse.json({ places }, { headers: PRIVATE_HEADERS });
  } catch (caught) {
    if (caught instanceof PlacesError) return jsonError(caught.message, caught.status);
    console.error("suggestions failed", caught);
    return jsonError("Place suggestions are temporarily unavailable. Please try again.", 502);
  }
}
