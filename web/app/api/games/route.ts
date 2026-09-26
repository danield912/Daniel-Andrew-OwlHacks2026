import { NextRequest, NextResponse } from "next/server";
import { isTeam, SUPPORTED_TEAMS, teamForEvent, type Sport, type Team } from "@/lib/teams";

const PRIVATE_ERROR = { "Cache-Control": "no-store" };
const TICKETMASTER_TIMEOUT_MS = 10_000;
const TICKETMASTER_DOWN =
  "Game listings are temporarily unavailable. Please try again in a few minutes.";

type TicketmasterVenue = {
  name?: string;
  address?: { line1?: string };
  city?: { name?: string };
  state?: { stateCode?: string };
  location?: { latitude?: string; longitude?: string };
};

type TicketmasterEvent = {
  id: string;
  name: string;
  url?: string;
  dates?: { start?: { dateTime?: string } };
  images?: Array<{ url?: string; ratio?: string }>;
  _embedded?: { venues?: TicketmasterVenue[] };
};

type TicketmasterResponse = { _embedded?: { events?: TicketmasterEvent[] } };

type Game = {
  id: string;
  team: Team;
  sport: Sport;
  homeTeam: string;
  opponent: string;
  startsAt: string;
  venue: { name: string; address: string; latitude?: number; longitude?: number };
  ticketUrl?: string;
  imageUrl?: string;
};

function getEventTeam(event: TicketmasterEvent): Team | undefined {
  return teamForEvent(event.name, event._embedded?.venues?.[0]?.name);
}

function getOpponent(eventName: string, homeTeam: string): string {
  return eventName
    .replace(new RegExp(homeTeam, "i"), "")
    .replace(/^\s*(vs\.?|v\.?|@|at)\s*/i, "")
    .trim();
}

function toGame(event: TicketmasterEvent, team: Team): Game | undefined {
  const startsAt = event.dates?.start?.dateTime;
  const venue = event._embedded?.venues?.[0];

  if (!startsAt || !venue?.name) return undefined;

  const latitude = venue.location?.latitude;
  const longitude = venue.location?.longitude;
  const imageUrl = event.images?.find((image) => image.ratio === "16_9")?.url;

  return {
    id: event.id,
    team,
    sport: SUPPORTED_TEAMS[team].sport,
    homeTeam: SUPPORTED_TEAMS[team].name,
    opponent: getOpponent(event.name, SUPPORTED_TEAMS[team].name),
    startsAt,
    venue: {
      name: venue.name,
      address: [venue.address?.line1, venue.city?.name, venue.state?.stateCode]
        .filter(Boolean)
        .join(", "),
      ...(latitude ? { latitude: Number(latitude) } : {}),
      ...(longitude ? { longitude: Number(longitude) } : {}),
    },
    ...(event.url ? { ticketUrl: event.url } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.TICKETMASTER_API_KEY;

  if (!apiKey) {
    console.error("TICKETMASTER_API_KEY is not set");
    return NextResponse.json({ error: TICKETMASTER_DOWN }, { status: 503, headers: PRIVATE_ERROR });
  }

  const teamFilter = request.nextUrl.searchParams.get("team");

  if (teamFilter && !isTeam(teamFilter)) {
    return NextResponse.json(
      { error: "Unsupported team. Use eagles, phillies, sixers, or temple." },
      { status: 400 }
    );
  }

  const url = new URL(
    "https://app.ticketmaster.com/discovery/v2/events.json"
  );

  // Keep the URL stable for five minutes so Next's revalidation cache can work.
  const startDate = new Date();
  startDate.setUTCSeconds(0, 0);
  startDate.setUTCMinutes(Math.floor(startDate.getUTCMinutes() / 5) * 5);

  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("countryCode", "US");
  url.searchParams.set("classificationName", "Sports");
  url.searchParams.set("city", "Philadelphia");
  url.searchParams.set("startDateTime", startDate.toISOString().replace(/\.\d{3}Z$/, "Z"));
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("size", "100");

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(TICKETMASTER_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error("Ticketmaster events failed", response.status);
      return NextResponse.json({ error: TICKETMASTER_DOWN }, { status: 502, headers: PRIVATE_ERROR });
    }

    const data = (await response.json()) as TicketmasterResponse;
    const now = Date.now();
    const games = (data._embedded?.events ?? [])
      .map((event) => {
        const team = getEventTeam(event);
        return team ? toGame(event, team) : undefined;
      })
      .filter((game): game is Game => Boolean(game))
      .filter((game) => Date.parse(game.startsAt) > now)
      .filter((game) => !teamFilter || game.team === teamFilter)
      .sort((first, second) => first.startsAt.localeCompare(second.startsAt));

    return NextResponse.json({ games });
  } catch (caught) {
    // Network failure, timeout, or a malformed response.
    console.error("Ticketmaster events unreachable", caught instanceof Error ? caught.message : caught);
    return NextResponse.json({ error: TICKETMASTER_DOWN }, { status: 502, headers: PRIVATE_ERROR });
  }
}
