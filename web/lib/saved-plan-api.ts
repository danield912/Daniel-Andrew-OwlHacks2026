import { teamAndSport } from "@/lib/teams";

export type TravelMode = "TRANSIT" | "DRIVE";

export type RouteSnapshot = {
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  steps: string[];
  warnings: string[];
  leaveByTime?: string;
  durationKind?: "scheduled" | "estimated";
  calculatedAt?: string;
};

export type SavePlanRequest = {
  clientRequestId: string;
  gameId: string;
  origin: string;
  travelMode: TravelMode;
  targetArrivalTime: string;
  preferences: Record<string, JsonValue>;
  itinerary: Record<string, JsonValue>;
  routeSnapshot: RouteSnapshot;
  routeCalculatedAt: string;
};

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OFFSET_TIMESTAMP_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i;
const MAX_JSON_LENGTH = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 8 || value === null) return value === null;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) {
    return value.length <= 100 && value.every((item) => isJsonValue(item, depth + 1));
  }
  if (!isRecord(value) || Object.keys(value).length > 100) return false;
  return Object.values(value).every((item) => isJsonValue(item, depth + 1));
}

function asRecord(value: unknown, label: string) {
  if (!isRecord(value) || !isJsonValue(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  if (JSON.stringify(value).length > MAX_JSON_LENGTH) {
    throw new Error(`${label} is too large.`);
  }
  return value as Record<string, JsonValue>;
}

export function toIsoTimestamp(value: unknown, label: string) {
  if (typeof value !== "string" || !OFFSET_TIMESTAMP_PATTERN.test(value)) {
    throw new Error(`${label} must be an ISO 8601 timestamp with a timezone.`);
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label} must be a valid timestamp.`);
  }

  return new Date(timestamp).toISOString();
}

function toStringArray(value: unknown, label: string, maxItems: number) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`${label} must be a list with at most ${maxItems} items.`);
  }
  if (!value.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 500)) {
    throw new Error(`${label} must contain short, non-empty text.`);
  }
  return value.map((item) => item.trim());
}

function parseRouteSnapshot(value: unknown) {
  const snapshot = asRecord(value, "routeSnapshot");
  const departureTime = toIsoTimestamp(snapshot.departureTime, "routeSnapshot.departureTime");
  const arrivalTime = toIsoTimestamp(snapshot.arrivalTime, "routeSnapshot.arrivalTime");

  if (
    typeof snapshot.durationMinutes !== "number" ||
    !Number.isInteger(snapshot.durationMinutes) ||
    snapshot.durationMinutes < 0 ||
    snapshot.durationMinutes > 1_440
  ) {
    throw new Error("routeSnapshot.durationMinutes must be a whole number from 0 to 1440.");
  }

  const leaveByTime = snapshot.leaveByTime === undefined
    ? undefined
    : toIsoTimestamp(snapshot.leaveByTime, "routeSnapshot.leaveByTime");
  const durationKind = snapshot.durationKind;
  if (durationKind !== undefined && durationKind !== "scheduled" && durationKind !== "estimated") {
    throw new Error("routeSnapshot.durationKind must be scheduled or estimated.");
  }

  return {
    departureTime,
    arrivalTime,
    durationMinutes: snapshot.durationMinutes,
    steps: toStringArray(snapshot.steps, "routeSnapshot.steps", 40),
    warnings: toStringArray(snapshot.warnings, "routeSnapshot.warnings", 20),
    ...(leaveByTime ? { leaveByTime } : {}),
    ...(durationKind ? { durationKind } : {}),
    ...(snapshot.calculatedAt === undefined
      ? {}
      : { calculatedAt: toIsoTimestamp(snapshot.calculatedAt, "routeSnapshot.calculatedAt") }),
  } satisfies RouteSnapshot;
}

export function parseSavePlanRequest(value: unknown): SavePlanRequest {
  if (!isRecord(value)) throw new Error("Send a JSON request body.");

  const clientRequestId = typeof value.clientRequestId === "string"
    ? value.clientRequestId.trim()
    : "";
  if (!UUID_PATTERN.test(clientRequestId)) {
    throw new Error("clientRequestId must be a UUID.");
  }

  const gameId = typeof value.gameId === "string" ? value.gameId.trim() : "";
  if (!gameId || gameId.length > 200) throw new Error("gameId is required.");

  const origin = typeof value.origin === "string" ? value.origin.trim() : "";
  if (origin.length < 2 || origin.length > 200) {
    throw new Error("origin must be between 2 and 200 characters.");
  }

  if (value.travelMode !== "TRANSIT" && value.travelMode !== "DRIVE") {
    throw new Error("travelMode must be TRANSIT or DRIVE.");
  }

  const routeSnapshot = parseRouteSnapshot(value.routeSnapshot);
  const routeCalculatedAt = value.routeCalculatedAt === undefined
    ? routeSnapshot.calculatedAt
    : toIsoTimestamp(value.routeCalculatedAt, "routeCalculatedAt");

  if (!routeCalculatedAt) {
    throw new Error("routeCalculatedAt is required.");
  }

  return {
    clientRequestId,
    gameId,
    origin,
    travelMode: value.travelMode,
    targetArrivalTime: toIsoTimestamp(value.targetArrivalTime, "targetArrivalTime"),
    preferences: asRecord(value.preferences, "preferences"),
    itinerary: asRecord(value.itinerary, "itinerary"),
    routeSnapshot,
    routeCalculatedAt,
  };
}

export type SavedPlanRow = {
  id: string;
  title: string;
  game_id: string;
  game: unknown;
  origin: string;
  travel_mode: TravelMode;
  target_arrival_time: string;
  preferences: Record<string, JsonValue>;
  itinerary: Record<string, JsonValue>;
  route_snapshot: RouteSnapshot;
  route_calculated_at: string;
  created_at: string;
  plan_members?: Array<{ user_id: string; role: "leader" | "co_leader" | "member" }>;
};

// Adds { team, sport } to a stored game (older plans don't have them saved).
export function withTeamAndSport(game: unknown) {
  const g = (game && typeof game === "object" ? game : {}) as {
    name?: string;
    venue?: { name?: string };
    team?: unknown;
    sport?: unknown;
  };
  const derived = teamAndSport(g.name, g.venue?.name);
  return {
    ...g,
    team: typeof g.team === "string" ? g.team : derived.team,
    sport: typeof g.sport === "string" ? g.sport : derived.sport,
  };
}

export function serializeSavedPlan(row: SavedPlanRow, userId: string) {
  const role = row.plan_members?.find((member) => member.user_id === userId)?.role;
  if (!role) throw new Error("Plan membership is missing.");

  return {
    id: row.id,
    title: row.title,
    role,
    createdAt: row.created_at,
    gameId: row.game_id,
    game: withTeamAndSport(row.game),
    origin: row.origin,
    travelMode: row.travel_mode,
    targetArrivalTime: row.target_arrival_time,
    preferences: row.preferences,
    itinerary: row.itinerary,
    routeSnapshot: row.route_snapshot,
    routeCalculatedAt: row.route_calculated_at,
  };
}
