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
  budget: string;
  pregame: string;
  route: RouteSnapshot;
  routeCalculatedAt: string;
};

export type SavedPlan = SavePlanInput & {
  id: string;
  title: string;
  role: "leader" | "co_leader" | "member";
  createdAt: string;
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
  url.searchParams.set("travelmode", mode === "TRANSIT" ? "transit" : "driving");
  return url.toString();
}
