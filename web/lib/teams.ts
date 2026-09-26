// Shared team/sport lookup for /api/games and saved plans.

export type Team = "eagles" | "phillies" | "sixers" | "temple";
export type Sport = "football" | "baseball" | "basketball";

export const SUPPORTED_TEAMS: Record<Team, { name: string; sport: Sport; venues: readonly string[] }> = {
  eagles: { name: "Philadelphia Eagles", sport: "football", venues: ["Lincoln Financial Field"] },
  phillies: { name: "Philadelphia Phillies", sport: "baseball", venues: ["Citizens Bank Park"] },
  // Ticketmaster may still use the arena's former name in older records.
  sixers: {
    name: "Philadelphia 76ers",
    sport: "basketball",
    venues: ["Wells Fargo Center", "Xfinity Mobile Arena"],
  },
  temple: { name: "Temple Owls Football", sport: "football", venues: ["Lincoln Financial Field"] },
};

export function isTeam(value: string | null): value is Team {
  return value !== null && value in SUPPORTED_TEAMS;
}

// Strict match used for /api/games: team name in the event AND the right venue.
export function teamForEvent(eventName: string, venueName: string | undefined): Team | undefined {
  const event = eventName.toLocaleLowerCase();
  const venue = venueName?.toLocaleLowerCase();
  return (Object.keys(SUPPORTED_TEAMS) as Team[]).find((team) => {
    const config = SUPPORTED_TEAMS[team];
    const nameMatches =
      event.includes(config.name.toLocaleLowerCase()) ||
      (team === "temple" && event.includes("temple") && event.includes("football"));
    return nameMatches && config.venues.some((v) => venue === v.toLocaleLowerCase());
  });
}

// Lenient match for saved plans (older plans didn't store team/sport).
// The venue decides the sport; the Linc is Temple only if the name says so.
export function teamAndSport(gameName: string | undefined, venueName: string | undefined) {
  const name = (gameName ?? "").toLocaleLowerCase();
  const venue = (venueName ?? "").toLocaleLowerCase();
  let team: Team | null = null;
  if (venue.includes("lincoln financial")) team = name.includes("temple") ? "temple" : "eagles";
  else if (venue.includes("citizens bank")) team = "phillies";
  else if (venue.includes("wells fargo") || venue.includes("xfinity")) team = "sixers";
  else if (name.includes("temple")) team = "temple";
  else if (name.includes("eagles")) team = "eagles";
  else if (name.includes("phillies")) team = "phillies";
  else if (name.includes("76ers") || name.includes("sixers")) team = "sixers";
  return { team, sport: team ? SUPPORTED_TEAMS[team].sport : null };
}
