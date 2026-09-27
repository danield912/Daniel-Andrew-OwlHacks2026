// Server-only: a route home after the game, from the stadium (or your last
// after-game stop) back to your own starting point, via Google Routes.
// Computed on request and never stored (Google's rules on route data).

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

type Place = { lat: number; lng: number } | { address: string };

type RouteStep = {
  travelMode?: string;
  navigationInstruction?: { instructions?: string };
  transitDetails?: {
    transitLine?: { nameShort?: string; name?: string };
    stopDetails?: { departureTime?: string; arrivalTime?: string; departureStop?: { name?: string }; arrivalStop?: { name?: string } };
  };
};

export type HomeRoute = {
  leaveAt: string; // when you'd head out
  firstRideAt: string | null; // first train/bus departure (transit)
  firstRideFrom: string | null;
  arrivalTime: string;
  durationMinutes: number;
  steps: string[];
  lines: string[];
};

export class RouteHomeError extends Error {}

function waypoint(place: Place) {
  return "address" in place
    ? { address: place.address }
    : { location: { latLng: { latitude: place.lat, longitude: place.lng } } };
}

function formatStep(step: RouteStep) {
  const transit = step.transitDetails;
  const line = transit?.transitLine?.nameShort ?? transit?.transitLine?.name;
  const from = transit?.stopDetails?.departureStop?.name;
  const to = transit?.stopDetails?.arrivalStop?.name;
  if (step.travelMode === "TRANSIT" && line && from && to) return `Take ${line} from ${from} to ${to}`;
  const text = step.navigationInstruction?.instructions ?? (step.travelMode === "WALK" ? "Walk to the next stop" : "Continue");
  return text.replace(/\s*\n\s*/g, " · ");
}

export async function routeHome(from: Place, to: Place, mode: "TRANSIT" | "DRIVE", leaveAt: number): Promise<HomeRoute | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) throw new RouteHomeError("Route planning isn’t configured yet.");
  // Google needs a departure time that isn't in the past.
  const departure = Math.max(leaveAt, Date.now() + 60_000);

  let response: Response;
  try {
    response = await fetch(ROUTES_URL, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": [
          "routes.duration",
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
      body: JSON.stringify({
        origin: waypoint(from),
        destination: waypoint(to),
        travelMode: mode,
        departureTime: new Date(departure).toISOString(),
        languageCode: "en-US",
        units: "IMPERIAL",
        ...(mode === "DRIVE" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
      }),
    });
  } catch {
    throw new RouteHomeError("Routes are temporarily unavailable. Please try again.");
  }
  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok) throw new RouteHomeError("Routes are temporarily unavailable. Please try again.");

  const data = (await response.json().catch(() => null)) as { routes?: Array<{ duration?: string; legs?: Array<{ steps?: RouteStep[] }> }> } | null;
  const route = data?.routes?.[0];
  const seconds = Number(route?.duration?.replace(/s$/, ""));
  if (!route || !Number.isFinite(seconds)) return null;

  const steps = route.legs?.flatMap(leg => leg.steps ?? []) ?? [];
  const rides = steps.filter(step => step.travelMode === "TRANSIT");
  const firstRide = rides[0]?.transitDetails;
  const lastRideArrival = rides.at(-1)?.transitDetails?.stopDetails?.arrivalTime;
  const text = steps.map(formatStep);
  const lines: string[] = [];
  for (const ride of rides) {
    const line = ride.transitDetails?.transitLine?.nameShort ?? ride.transitDetails?.transitLine?.name;
    if (line && !lines.includes(line)) lines.push(line);
  }
  const arrival = departure + seconds * 1000;

  return {
    leaveAt: new Date(departure).toISOString(),
    firstRideAt: firstRide?.stopDetails?.departureTime ?? null,
    firstRideFrom: firstRide?.stopDetails?.departureStop?.name ?? null,
    arrivalTime: new Date(Math.max(arrival, lastRideArrival ? Date.parse(lastRideArrival) : 0)).toISOString(),
    durationMinutes: Math.ceil(seconds / 60),
    steps: text,
    lines,
  };
}

function phillyHour(iso: string) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date(iso)));
}

function clock(iso: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

// Plain-language heads-ups about getting home late.
export function homeWarnings(route: HomeRoute | null, mode: "TRANSIT" | "DRIVE", leaveAt: number) {
  const warnings: string[] = [];
  if (!route) {
    warnings.push(mode === "TRANSIT"
      ? "We couldn’t find a SEPTA route home around then. Plan a ride-share or a ride with a friend."
      : "We couldn’t find a driving route home. Check your starting address.");
    return warnings;
  }
  if (mode === "TRANSIT" && route.firstRideAt) {
    const wait = Math.round((Date.parse(route.firstRideAt) - leaveAt) / 60_000);
    if (wait >= 45) {
      warnings.push(`The next SEPTA ride home isn’t until ${clock(route.firstRideAt)}${route.firstRideFrom ? ` from ${route.firstRideFrom}` : ""}. Consider a ride-share.`);
    }
  }
  const hour = phillyHour(route.arrivalTime);
  if (hour >= 0 && hour < 5) warnings.push(`You’d get home around ${clock(route.arrivalTime)}. Late-night service runs less often, so check SEPTA before you leave.`);
  return warnings;
}
