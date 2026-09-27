// Browser-side types and helpers for the live group map (see supabase/LIVE_MAP.md).

export type LiveLocation = {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  updatedAt: string;
  isYou: boolean;
};

export type LiveWindow = { startsAt: string; endsAt: string };

export type AlertTarget = { kind: "stop" | "stadium" | "kickoff"; name: string; at: string };

export type LateAlert = {
  id: string;
  userId: string;
  name: string;
  kind: "manual" | "auto";
  minutesLate: number;
  target: AlertTarget | null;
  eta: string | null;
  note: string | null;
  createdAt: string;
  isYou: boolean;
};

export type EtaResult = {
  target: AlertTarget | null;
  etaAt?: string;
  minutes?: number;
  lateByMinutes?: number;
  calculatedAt?: string;
  travelMode?: "TRANSIT" | "DRIVE";
  note?: string | null; // e.g. "Looks like they missed the 10:15 AM B1 train at Cecil B. Moore."
};

export class LiveError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function liveRequest(path: string, init: RequestInit = {}, fallback = "Something went wrong. Please try again.") {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new LiveError("The live map isn’t connected yet.", response.status);
  }
  const data = await response.json();
  if (!response.ok) throw new LiveError(data.error || fallback, response.status);
  return data;
}

export function windowState(window: LiveWindow | null, now: number): "unknown" | "before" | "open" | "ended" {
  if (!window) return "unknown";
  if (now < Date.parse(window.startsAt)) return "before";
  if (now > Date.parse(window.endsAt)) return "ended";
  return "open";
}

export type LateTone = "on-time" | "late" | "very-late";

export function lateTone(minutesLate: number | null | undefined): LateTone {
  if (!minutesLate || minutesLate < 5) return "on-time";
  return minutesLate >= 15 ? "very-late" : "late";
}

export const TONE_LOOK: Record<LateTone, { label: (minutes: number) => string; chip: string; ring: string; emoji: string }> = {
  "on-time": { label: () => "On time", chip: "bg-mint-300/15 text-mint-200", ring: "#5eead4", emoji: "🟢" },
  late: { label: minutes => `~${minutes} min late`, chip: "bg-amber-300/15 text-amber-200", ring: "#fbbf24", emoji: "🟡" },
  "very-late": { label: minutes => `~${minutes} min late`, chip: "bg-rose-500/15 text-rose-200", ring: "#fb7185", emoji: "🔴" },
};

export function clock(iso: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function timeAgo(iso: string, now: number) {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} hr ago`;
}

// "Jordan might be ~12 min late to Lincoln Financial Field"
export function alertHeadline(alert: LateAlert) {
  const who = alert.isYou ? "You" : alert.name;
  const to = alert.target ? ` to ${alert.target.kind === "kickoff" ? "kickoff" : alert.target.name}` : "";
  return `${who} might be ~${alert.minutesLate} min late${to}`;
}

// Reasons for the "I'm running late" button. The note is what the crew sees.
export const LATE_REASONS = [
  { id: "train", emoji: "🚇", label: "Missed my train", note: "Missed my train 🚇" },
  { id: "bus", emoji: "🚌", label: "Missed my bus", note: "Missed my bus 🚌" },
  { id: "traffic", emoji: "🚗", label: "Stuck in traffic", note: "Stuck in traffic 🚗" },
  { id: "behind", emoji: "⏰", label: "Running behind", note: "Running behind ⏰" },
] as const;

export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export function distanceLabel(meters: number) {
  const miles = meters / 1609.34;
  const walk = Math.max(1, Math.ceil((meters * 1.25) / 80));
  return miles < 0.2 ? `${Math.round(meters * 3.28)} ft away · ~${walk} min walk` : `${miles.toFixed(1)} mi away${walk <= 30 ? ` · ~${walk} min walk` : ""}`;
}
