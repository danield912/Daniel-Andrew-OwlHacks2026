import { NextRequest, NextResponse } from "next/server";
import {
  parseSavePlanRequest,
  serializeSavedPlan,
  type SavedPlanRow,
} from "@/lib/saved-plan-api";
import { createClient } from "@/lib/supabase/server";

const TICKETMASTER_EVENT_URL =
  "https://app.ticketmaster.com/discovery/v2/events";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

const PLAN_SELECT = [
  "id",
  "title",
  "game_id",
  "game",
  "origin",
  "travel_mode",
  "target_arrival_time",
  "preferences",
  "itinerary",
  "route_snapshot",
  "route_calculated_at",
  "created_at",
  "plan_members!inner(user_id,role)",
].join(",");

type TicketmasterVenue = {
  name?: string;
  address?: { line1?: string };
  city?: { name?: string };
  state?: { stateCode?: string };
  location?: { latitude?: string; longitude?: string };
};

type TicketmasterEvent = {
  name?: string;
  dates?: { start?: { dateTime?: string } };
  _embedded?: { venues?: TicketmasterVenue[] };
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: PRIVATE_HEADERS });
}

function finiteCoordinate(value: string | undefined) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

async function currentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : data.user };
}

async function canonicalGame(gameId: string) {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) throw new Error("Game lookup is not configured yet.");

  const url = new URL(`${TICKETMASTER_EVENT_URL}/${encodeURIComponent(gameId)}.json`);
  url.searchParams.set("apikey", apiKey);

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new Error("Game details are temporarily unavailable. Please try again.");
  }

  if (response.status === 404) throw new Error("This game is no longer available.");
  if (!response.ok) throw new Error("Game details are temporarily unavailable. Please try again.");

  const event = (await response.json()) as TicketmasterEvent;
  const venue = event._embedded?.venues?.[0];
  const startsAt = event.dates?.start?.dateTime;
  const name = event.name?.trim();

  if (!name || !startsAt || !Number.isFinite(Date.parse(startsAt)) || !venue?.name?.trim()) {
    throw new Error("This game is missing its venue or start time.");
  }

  return {
    name,
    startsAt: new Date(startsAt).toISOString(),
    venue: {
      name: venue.name.trim(),
      address: [venue.address?.line1, venue.city?.name, venue.state?.stateCode]
        .filter(Boolean)
        .join(", "),
      latitude: finiteCoordinate(venue.location?.latitude),
      longitude: finiteCoordinate(venue.location?.longitude),
    },
  };
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await currentUser();
  if (!user) return jsonError("Please sign in.", 401);

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return jsonError("Send a JSON request body.", 400);
  }

  let input;
  try {
    input = parseSavePlanRequest(requestBody);
  } catch (caught) {
    return jsonError(caught instanceof Error ? caught.message : "Invalid plan input.", 400);
  }

  // A retry returns before touching Ticketmaster again. The unique database
  // constraint remains the final guard against concurrent duplicate requests.
  const { data: existing, error: existingError } = await supabase
    .from("plans")
    .select("id")
    .eq("created_by", user.id)
    .eq("client_request_id", input.clientRequestId)
    .maybeSingle();

  if (existingError) return jsonError("We couldn’t save your plan. Please try again.", 500);
  if (existing) {
    return NextResponse.json({ plan: { id: existing.id } }, { headers: PRIVATE_HEADERS });
  }

  let game;
  try {
    game = await canonicalGame(input.gameId);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "We couldn’t verify this game.";
    const status = message.includes("temporarily") || message.includes("configured") ? 502 : 400;
    return jsonError(message, status);
  }

  const targetArrival = Date.parse(input.targetArrivalTime);
  if (targetArrival <= Date.now()) {
    return jsonError("targetArrivalTime must be in the future.", 400);
  }
  if (targetArrival > Date.parse(game.startsAt)) {
    return jsonError("targetArrivalTime must be on or before the game start time.", 400);
  }

  const title = `${game.name} at ${game.venue.name}`.slice(0, 200);
  const { data, error } = await supabase.rpc("create_plan_with_leader", {
    p_client_request_id: input.clientRequestId,
    p_title: title,
    p_game_id: input.gameId,
    p_game: game,
    p_origin: input.origin,
    p_travel_mode: input.travelMode,
    p_target_arrival_time: input.targetArrivalTime,
    p_preferences: input.preferences,
    p_itinerary: input.itinerary,
    p_route_snapshot: input.routeSnapshot,
    p_route_calculated_at: input.routeCalculatedAt,
  });

  const result = Array.isArray(data) ? data[0] : data;
  if (error || !result?.id) {
    return jsonError("We couldn’t save your plan. Please try again.", 500);
  }

  return NextResponse.json(
    { plan: { id: result.id } },
    { status: result.created ? 201 : 200, headers: PRIVATE_HEADERS },
  );
}

export async function GET() {
  const { supabase, user } = await currentUser();
  if (!user) return jsonError("Please sign in.", 401);

  const { data, error } = await supabase
    .from("plans")
    .select(PLAN_SELECT)
    .eq("plan_members.user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) return jsonError("We couldn’t load your plans. Please try again.", 500);

  try {
    return NextResponse.json(
      { plans: (data ?? []).map((plan) => serializeSavedPlan(plan as unknown as SavedPlanRow, user.id)) },
      { headers: PRIVATE_HEADERS },
    );
  } catch {
    return jsonError("We couldn’t load your plans. Please try again.", 500);
  }
}
