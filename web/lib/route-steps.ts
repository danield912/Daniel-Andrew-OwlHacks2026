// Picks an emoji for a route step. On transit trips, everything that isn't a
// ride ("Take B1 from … to …") is walking. SEPTA buses have numbered routes
// ("Take 4 from …"), trolleys are T/G/D lines, and B/L/M lines are trains.
export function stepEmoji(step: string, mode: "TRANSIT" | "DRIVE") {
  const ride = step.match(/^take (.+?) from .+ to /i);
  if (mode === "TRANSIT") {
    if (!ride) return "🚶";
    const line = ride[1].trim();
    if (/bus|route/i.test(line) || /^\d{1,3}[A-Z]?$/.test(line)) return "🚌";
    if (/^[TGD]\d$/i.test(line) || /trolley/i.test(line)) return "🚋";
    return "🚇";
  }
  return /walk|stairs/i.test(step) ? "🚶" : "🚗";
}
