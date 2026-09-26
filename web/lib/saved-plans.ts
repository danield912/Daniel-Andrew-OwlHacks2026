export type RouteSnapshot = {
  status: "ok";
  departureTime: string;
  arrivalTime: string;
  leaveByTime?: string;
  durationMinutes: number;
  durationKind?: "scheduled" | "estimated";
  steps: string[];
  warnings: string[];
};

export type SavePlanInput = {
  gameId: string;
  origin: string;
  travelMode: "TRANSIT" | "DRIVE";
  targetArrivalTime: string;
  preferences: { budget: string; pregame: string };
  itinerary: Record<string, unknown>;
  routeSnapshot: RouteSnapshot;
  routeCalculatedAt: string;
};

export type PlanRole = "leader" | "co_leader" | "member";

export type StopSlot = "before" | "after";
// A place near the venue, looked up fresh from Google Places (never stored).
// Matches SuggestedPlace in lib/places.ts (Andrew's API).
export type Place = {
  placeId: string;
  name: string;
  category: string; // Google's label, e.g. "Sports bar", "Italian restaurant", "Tailgate"
  priceLevel: number | null; // 0 = free, 1 = $ … 4 = $$$$
  rating: number | null;
  ratingCount?: number | null; // not sent by the API yet
  address: string;
  location: { lat: number; lng: number };
  walkMinutes: number | null;
  mapsUrl: string;
};

// What the database stores for a stop: only the place id, slot, and time.
export type StopInput = { placeId: string; slot: StopSlot; time: string };

// A saved stop with fresh place details (null if Google couldn't return them).
export type PlanStop = StopInput & {
  place: Pick<Place, "name" | "address" | "location" | "category"> | null;
};

export type PlanMember = {
  userId: string;
  name: string;
  role: PlanRole;
  isYou: boolean;
};

// Saved routes can be cleared later (Google's storage rules), so a saved plan's
// route fields may be null even though saving always sends them.
export type SavedPlan = Omit<SavePlanInput, "routeSnapshot" | "routeCalculatedAt"> & {
  routeSnapshot: RouteSnapshot | null;
  routeCalculatedAt: string | null;
  id: string;
  gameId: string;
  title: string;
  role: PlanRole;
  createdAt: string;
  members?: PlanMember[];
  stops?: PlanStop[];
  game: {
    name: string;
    startsAt: string;
    venue: {
      name: string;
      address: string;
      latitude: number | null;
      longitude: number | null;
    };
  };
};

export type InvitePreview = {
  planId: string;
  planTitle: string;
  invitedBy: string;
  expiresAt: string;
  alreadyMember: boolean;
  game: {
    name: string;
    startsAt: string;
    venue: { name: string };
  };
};

export const roleLabels: Record<PlanRole, string> = {
  leader: "Leader",
  co_leader: "Co-leader",
  member: "Member",
};

export function canInvite(role: PlanRole) {
  return role === "leader" || role === "co_leader";
}

export function planTime(value: string) {
  if (!Number.isFinite(Date.parse(value))) return "Time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

export async function plansRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (response.redirected || response.status === 401) {
    throw new Error("Please sign in to access your plans.");
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Saved plans are not connected yet. Please try again once the plans API is ready.");
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "We couldn’t load this plan. It may be unavailable or you may not have access.");
  }
  return data;
}

export function directionsUrl(origin: string, destination: string, mode: string) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("travelmode", mode === "TRANSIT" ? "transit" : mode === "WALK" ? "walking" : "driving");
  return url.toString();
}
