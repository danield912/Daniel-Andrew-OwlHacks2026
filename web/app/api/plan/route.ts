import { NextRequest, NextResponse } from "next/server";

const TICKETMASTER_EVENT_URL =
  "https://app.ticketmaster.com/discovery/v2/events";
const GOOGLE_ROUTES_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";
const MAX_TRANSIT_LOOKAHEAD_MS = 100 * 24 * 60 * 60 * 1000;

type TravelMode = "TRANSIT" | "DRIVE";

type PlanRequest = {
  gameId?: unknown;
  origin?: unknown;
  travelMode?: unknown;
  targetArrivalTime?: unknown;
  arrivalBufferMinutes?: unknown;
};

type TicketmasterVenue = {
  name?: string;
  address?: { line1?: string };
  city?: { name?: string };
  state?: { stateCode?: string };
  location?: { latitude?: string; longitude?: string };
};

type TicketmasterEvent = {
  dates?: { start?: { dateTime?: string } };
  _embedded?: { venues?: TicketmasterVenue[] };
};

type RouteStep = {
  travelMode?: string;
  navigationInstruction?: { instructions?: string };
  transitDetails?: {
    transitLine?: { nameShort?: string; name?: string };
    stopDetails?: {
      departureTime?: string;
      arrivalTime?: string;
      departureStop?: { name?: string };
      arrivalStop?: { name?: string };
    };
  };
};

type GoogleRoute = {
  duration?: string;
  warnings?: string[];
  legs?: Array<{ steps?: RouteStep[] }>;
};

type GoogleRoutesResponse = { routes?: GoogleRoute[] };

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function unavailable(message: string) {
  return NextResponse.json({ status: "unavailable", message });
}

function isTravelMode(value: unknown): value is TravelMode {
  return value === "TRANSIT" || value === "DRIVE";
}

function parseDurationSeconds(value: string | undefined) {
  const match = value?.match(/^(-?\d+(?:\.\d+)?)s$/);
  const seconds = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function toIso(milliseconds: number) {
  return new Date(milliseconds).toISOString();
}

function parseTargetArrivalTime(value: unknown) {
  if (
    typeof value !== "string" ||
    !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    return undefined;
  }

  return Date.parse(value);
}

function getDestination(venue: TicketmasterVenue) {
  const latitude = Number(venue.location?.latitude);
  const longitude = Number(venue.location?.longitude);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { location: { latLng: { latitude, longitude } } };
  }

  const address = [
    venue.name,
    venue.address?.line1,
    venue.city?.name,
    venue.state?.stateCode,
  ]
    .filter(Boolean)
    .join(", ");

  return address ? { address } : undefined;
}

function routeSteps(route: GoogleRoute) {
  return route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
}

function formatStep(step: RouteStep) {
  const transit = step.transitDetails;
  const line = transit?.transitLine?.nameShort ?? transit?.transitLine?.name;
  const from = transit?.stopDetails?.departureStop?.name;
  const to = transit?.stopDetails?.arrivalStop?.name;

  if (step.travelMode === "TRANSIT" && line && from && to) {
    return `Take ${line} from ${from} to ${to}`;
  }

  return step.navigationInstruction?.instructions ??
    (step.travelMode === "WALK" ? "Walk to the next stop" : "Continue to the destination");
}

function asPlanRequest(value: unknown): PlanRequest | undefined {
  return value && typeof value === "object" ? (value as PlanRequest) : undefined;
}

export async function POST(request: NextRequest) {
  let payload: PlanRequest | undefined;

  try {
    payload = asPlanRequest(await request.json());
  } catch {
    return badRequest("Send a JSON request body.");
  }

  if (!payload) return badRequest("Send a JSON request body.");

  const gameId = typeof payload.gameId === "string" ? payload.gameId.trim() : "";
  const origin = typeof payload.origin === "string" ? payload.origin.trim() : "";
  const arrivalBufferMinutes = payload.arrivalBufferMinutes;
  const suppliedTargetArrival = parseTargetArrivalTime(payload.targetArrivalTime);
  const legacyArrivalBuffer = typeof arrivalBufferMinutes === "number"
    ? arrivalBufferMinutes
    : undefined;

  if (!gameId || gameId.length > 200) return badRequest("gameId is required.");
  if (origin.length < 2 || origin.length > 200) {
    return badRequest("origin must be between 2 and 200 characters.");
  }
  if (!isTravelMode(payload.travelMode)) {
    return badRequest("travelMode must be TRANSIT or DRIVE.");
  }
  if (payload.targetArrivalTime !== undefined && suppliedTargetArrival === undefined) {
    return badRequest("targetArrivalTime must be an ISO 8601 timestamp with a timezone.");
  }
  if (suppliedTargetArrival === undefined && (
    legacyArrivalBuffer === undefined ||
    !Number.isInteger(legacyArrivalBuffer) ||
    legacyArrivalBuffer < 0 ||
    legacyArrivalBuffer > 180
  )) {
    return badRequest("targetArrivalTime is required.");
  }

  const ticketmasterApiKey = process.env.TICKETMASTER_API_KEY;
  const googleApiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;

  if (!ticketmasterApiKey || !googleApiKey) {
    return NextResponse.json(
      { error: "Route planning is not configured yet." },
      { status: 500 },
    );
  }

  const eventUrl = new URL(`${TICKETMASTER_EVENT_URL}/${encodeURIComponent(gameId)}.json`);
  eventUrl.searchParams.set("apikey", ticketmasterApiKey);

  let eventResponse: Response;
  try {
    eventResponse = await fetch(eventUrl, { cache: "no-store" });
  } catch {
    return NextResponse.json(
      { error: "Game details are temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }

  if (eventResponse.status === 404) return unavailable("This game is no longer available.");
  if (!eventResponse.ok) {
    return NextResponse.json(
      { error: "Game details are temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }

  const event = (await eventResponse.json()) as TicketmasterEvent;
  const gameStart = Date.parse(event.dates?.start?.dateTime ?? "");
  const destination = getDestination(event._embedded?.venues?.[0] ?? {});

  if (!Number.isFinite(gameStart) || !destination) {
    return unavailable("This game does not have enough venue or start-time information to plan a route.");
  }

  // `arrivalBufferMinutes` remains as a short-lived compatibility path while
  // the homepage moves to its Philadelphia-time arrival picker.
  const targetArrival = suppliedTargetArrival ?? gameStart - legacyArrivalBuffer! * 60_000;
  const now = Date.now();

  if (targetArrival <= now) {
    return unavailable("The requested stadium arrival time has already passed.");
  }
  if (targetArrival > gameStart) {
    return unavailable("The requested stadium arrival time is after the game starts.");
  }
  if (payload.travelMode === "TRANSIT" && targetArrival - now > MAX_TRANSIT_LOOKAHEAD_MS) {
    return unavailable("Transit schedules are available only up to 100 days ahead. Try again closer to game day.");
  }

  const isTransit = payload.travelMode === "TRANSIT";
  const routesRequest = {
    origin: { address: origin },
    destination,
    travelMode: payload.travelMode,
    languageCode: "en-US",
    units: "IMPERIAL",
    ...(isTransit
      ? { arrivalTime: toIso(targetArrival) }
      : {
          // Driving has no arrival-time request. This traffic-aware result is an estimate
          // at the intended stadium-arrival time and is converted to a leave-by time below.
          departureTime: toIso(targetArrival),
          routingPreference: "TRAFFIC_AWARE",
        }),
  };

  let routesResponse: Response;
  try {
    routesResponse = await fetch(GOOGLE_ROUTES_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleApiKey,
        "X-Goog-FieldMask": [
          "routes.duration",
          "routes.warnings",
          "routes.legs.steps.travelMode",
          "routes.legs.steps.navigationInstruction.instructions",
          "routes.legs.steps.transitDetails.transitLine.nameShort",
          "routes.legs.steps.transitDetails.transitLine.name",
          "routes.legs.steps.transitDetails.stopDetails.departureTime",
          "routes.legs.steps.transitDetails.stopDetails.arrivalTime",
          "routes.legs.steps.transitDetails.stopDetails.departureStop.name",
          "routes.legs.steps.transitDetails.stopDetails.arrivalStop.name",
        ].join(","),
      },
      body: JSON.stringify(routesRequest),
    });
  } catch {
    return NextResponse.json(
      { error: "Routes are temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }

  if (routesResponse.status === 400 || routesResponse.status === 404) {
    return unavailable("No route was found that arrives before your target time.");
  }
  if (!routesResponse.ok) {
    return NextResponse.json(
      { error: "Routes are temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }

  const routesData = (await routesResponse.json()) as GoogleRoutesResponse;
  const route = routesData.routes?.[0];
  const durationSeconds = parseDurationSeconds(route?.duration);

  if (!route || durationSeconds === undefined) {
    return unavailable("No route was found that arrives before your target time.");
  }

  const steps = routeSteps(route);
  const transitSteps = steps.filter((step) => step.travelMode === "TRANSIT");
  const scheduledDeparture = transitSteps[0]?.transitDetails?.stopDetails?.departureTime;
  const scheduledArrival = transitSteps.at(-1)?.transitDetails?.stopDetails?.arrivalTime;
  const leaveByTime = toIso(targetArrival - durationSeconds * 1_000);
  const arrivalTime = toIso(targetArrival);

  return NextResponse.json({
    status: "ok",
    calculatedAt: toIso(Date.now()),
    // Transit uses the actual selected service departure. Driving is an estimate.
    departureTime: isTransit && scheduledDeparture ? scheduledDeparture : leaveByTime,
    arrivalTime,
    leaveByTime,
    ...(isTransit && scheduledDeparture ? { scheduledDepartureTime: scheduledDeparture } : {}),
    ...(isTransit && scheduledArrival ? { scheduledTransitArrivalTime: scheduledArrival } : {}),
    durationMinutes: Math.ceil(durationSeconds / 60),
    durationKind: isTransit ? "scheduled" : "estimated",
    steps: steps.map(formatStep),
    warnings: route.warnings ?? [],
  });
}
