import type { TeamKey } from "@/lib/team-style";

export type Game = {
  id: string;
  name: string;
  opponent: string;
  tag?: string; // e.g. "Preseason", "Fan Appreciation Day"
  team: TeamKey;
  startTime: string | null;
  venue: string;
};

export type PlanResult = {
  status: "ok";
  departureTime: string;
  arrivalTime: string;
  leaveByTime: string;
  scheduledDepartureTime?: string;
  scheduledTransitArrivalTime?: string;
  durationMinutes: number;
  durationKind: "scheduled" | "estimated";
  steps: string[];
  warnings: string[];
};

export function formatGameTime(value: string | null, withWeekday = false) {
  if (!value) return "Date or time to be confirmed";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    ...(withWeekday ? { weekday: "short" as const } : {}),
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatClock(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
