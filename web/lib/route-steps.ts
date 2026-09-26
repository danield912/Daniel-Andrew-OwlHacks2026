// Picks an emoji for a route step. On transit trips, everything that isn't a
// ride ("Take B1 from … to …") is walking.
export function stepEmoji(step: string, mode: "TRANSIT" | "DRIVE") {
  const ride = /^take .+ from .+ to /i.test(step);
  if (mode === "TRANSIT") {
    if (ride) return /bus|route \d+/i.test(step) ? "🚌" : "🚇";
    return "🚶";
  }
  return /walk|stairs/i.test(step) ? "🚶" : "🚗";
}
