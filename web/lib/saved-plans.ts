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

// Where one person in the crew is coming from, with their own route.
export type MemberStart = {
  origin: string;
  location: { lat: number; lng: number } | null; // null if it couldn't be mapped
  travelMode: "TRANSIT" | "DRIVE";
  route: RouteSnapshot | null;
  routeCalculatedAt: string | null;
};

export type PlanMember = {
  userId: string;
  name: string;
  role: PlanRole;
  isYou: boolean;
  start?: MemberStart | null; // null until they add their starting point
};

// A stop a co-leader or member suggested; the leader approves or declines it.
export type StopSuggestion = StopInput & {
  id: string;
  status: "pending" | "approved" | "declined";
  createdAt: string;
  suggestedBy: { userId: string; name: string; isYou: boolean };
  place: PlanStop["place"];
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
  suggestions?: StopSuggestion[];
  game: {
    name: string;
    startsAt: string;
    ticketUrl?: string; // Ticketmaster page (plans saved after tickets were added)
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

// The crew's tier list: what each role can do.
export const ROLE_INFO: Record<PlanRole, { emoji: string; label: string; can: string[] }> = {
  leader: { emoji: "👑", label: "Leader", can: ["Adds and removes stops", "Approves suggestions", "Changes roles and removes people", "Invites friends", "Deletes the plan"] },
  co_leader: { emoji: "⭐", label: "Co-leader", can: ["Invites friends", "Suggests stops for the leader to approve", "Can leave the plan"] },
  member: { emoji: "🎟️", label: "Member", can: ["Suggests stops for the leader to approve", "Can leave the plan"] },
};

export function canInvite(role: PlanRole) {
  return role === "leader" || role === "co_leader";
}

// Only the leader changes the plan directly; everyone else suggests.
export function canEditStops(role: PlanRole) {
  return role === "leader";
}

export function myMember(plan: Pick<SavedPlan, "members">) {
  return plan.members?.find(member => member.isYou) ?? null;
}

// Ticketmaster link for a game, falling back to a search for older plans.
export function ticketLink(game: { name: string; ticketUrl?: string }) {
  return game.ticketUrl && /^https:\/\//.test(game.ticketUrl)
    ? game.ticketUrl
    : `https://www.ticketmaster.com/search?q=${encodeURIComponent(game.name)}`;
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
  // No origin: Google Maps starts from the person's current location.
  if (origin.trim()) url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("travelmode", mode === "TRANSIT" ? "transit" : mode === "WALK" ? "walking" : "driving");
  return url.toString();
}
