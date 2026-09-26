const PHILLY_TIME_ZONE = "America/New_York";

function phillyParts(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PHILLY_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

// "HH:MM" in Philadelphia time for an ISO timestamp, for <input type="time">.
export function phillyClockTime(iso: string) {
  const { hour, minute } = phillyParts(Date.parse(iso));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Combines the game's Philadelphia calendar date with an "HH:MM" Philadelphia
// clock time and returns the matching UTC ISO timestamp (handles daylight saving).
export function phillyTimeOnGameDay(gameStartIso: string, clockTime: string) {
  const match = clockTime.match(/^(\d{2}):(\d{2})$/);
  const gameStart = Date.parse(gameStartIso);
  if (!match || !Number.isFinite(gameStart)) return null;

  const { year, month, day } = phillyParts(gameStart);
  const wallClock = Date.UTC(year, month - 1, day, Number(match[1]), Number(match[2]));

  // Guess the offset, then correct it once in case the guess crossed a DST change.
  let timestamp = wallClock;
  for (let i = 0; i < 2; i += 1) {
    const shown = phillyParts(timestamp);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute);
    timestamp += wallClock - shownAsUtc;
  }
  return new Date(timestamp).toISOString();
}
