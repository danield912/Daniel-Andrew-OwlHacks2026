import type { Place, SavedPlan, StopSlot } from "@/lib/saved-plans";

export const MAX_STOPS = 6;

// The API already picks bars/restaurants from the pregame choice, so these
// chips just filter the returned list on the page.
export type PlaceGroup = "all" | "food" | "bar";

export const groupLabels: Record<PlaceGroup, string> = {
  all: "All",
  food: "Food",
  bar: "Bars",
};

export function placeGroup(place: Pick<Place, "category">): Exclude<PlaceGroup, "all"> | null {
  if (/bar|pub|tavern|brew|lounge|night ?club|beer|wine/i.test(place.category)) return "bar";
  if (/restaurant|food|pizza|cafe|coffee|bakery|deli|diner|grill|steak|sandwich|burger|kitchen|eatery|dessert|ice cream/i.test(place.category)) return "food";
  return null;
}

export const slotLabels: Record<StopSlot, string> = {
  before: "Before the game",
  after: "After the game",
};

// Rough game lengths so "after the game" suggestions start around the final whistle.
const gameLengthByVenue: [RegExp, number][] = [
  [/lincoln financial/i, 195], // Eagles and Temple football: ~3h15
  [/citizens bank/i, 180], // Phillies: ~3h
  [/wells fargo|xfinity|arena/i, 150], // 76ers: ~2h30
];

export function estimatedGameEnd(plan: Pick<SavedPlan, "game">) {
  const minutes = gameLengthByVenue.find(([pattern]) => pattern.test(plan.game.venue.name))?.[1] ?? 180;
  return new Date(Date.parse(plan.game.startsAt) + minutes * 60_000).toISOString();
}

export function stadiumArrival(plan: Pick<SavedPlan, "routeSnapshot" | "targetArrivalTime">) {
  return plan.routeSnapshot?.arrivalTime ?? plan.targetArrivalTime;
}

// Pregame happens around the stadium, from your arrive-by time until kickoff.
// (The API checks against targetArrivalTime, so we use it here too.)
export function pregameWindow(plan: SavedPlan) {
  return {
    start: plan.targetArrivalTime,
    minutes: Math.round((Date.parse(plan.game.startsAt) - Date.parse(plan.targetArrivalTime)) / 60_000),
  };
}

// Default time for a new stop: when you arrive at the stadium area, or when the game ends.
export function defaultStopTime(plan: SavedPlan, slot: StopSlot) {
  return slot === "before" ? pregameWindow(plan).start : estimatedGameEnd(plan);
}

// "$ — Budget-friendly" → 1, "$$ — Mid-range" → 2, "$$$ — Treat ourselves" → 3.
export function budgetLevel(budget: string) {
  const dollars = budget.match(/^\$+/)?.[0].length ?? 3;
  return Math.min(Math.max(dollars, 1), 4);
}

export function skipsPregame(pregame: string) {
  return /straight/i.test(pregame);
}

export function priceLabel(level: number | null) {
  if (level === null) return "Price n/a";
  return level === 0 ? "Free" : "$".repeat(level);
}

export function walkLabel(minutes: number | null) {
  if (minutes === null) return "";
  if (minutes <= 1) return "Right by the venue";
  return minutes > 30 ? `~${minutes} min walk · consider transit` : `~${minutes} min walk`;
}

// Checks a stop time against the plan. Returns an error message, or "" if it's fine.
export function stopTimeError(plan: SavedPlan, slot: StopSlot, iso: string | null) {
  if (!iso) return "Choose a time.";
  const time = Date.parse(iso);
  if (slot === "before") {
    if (time < Date.parse(plan.targetArrivalTime)) {
      return "Pregame stops start once you’ve arrived at the stadium area.";
    }
    if (time >= Date.parse(plan.game.startsAt)) {
      return "Pregame stops need to be before kickoff.";
    }
  } else {
    if (time <= Date.parse(plan.game.startsAt)) {
      return "After-game stops need to be after kickoff.";
    }
    if (time > Date.parse(plan.game.startsAt) + 12 * 60 * 60_000) {
      return "Pick a time within 12 hours after kickoff.";
    }
  }
  return "";
}
