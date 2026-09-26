// How each team looks in the UI: colors, emoji, gradients.
// Team matching itself lives in lib/teams.ts (shared with the API), so the
// screens and the server always agree on which team a game belongs to.
import { teamAndSport, type Sport, type Team as TeamKey } from "@/lib/teams";

export type { Sport, TeamKey };

export type Team = {
  key: TeamKey;
  name: string; // short name for chips
  fullName: string;
  sport: Sport;
  emoji: string;
  // Real team colors, tuned to stay readable on the dark stadium background.
  color: string; // main brand color
  glow: string; // brighter version for text, rings, and glows on dark
  gradient: string; // CSS gradient for banners and stripes
};

export const TEAMS: Record<TeamKey, Team> = {
  eagles: {
    key: "eagles",
    name: "Eagles",
    fullName: "Philadelphia Eagles",
    sport: "football",
    emoji: "🏈",
    color: "#004C54",
    glow: "#2dd4bf",
    gradient: "linear-gradient(135deg, #004C54 0%, #0b6b6b 45%, #A5ACAF 130%)",
  },
  phillies: {
    key: "phillies",
    name: "Phillies",
    fullName: "Philadelphia Phillies",
    sport: "baseball",
    emoji: "⚾",
    color: "#E81828",
    glow: "#fb7185",
    gradient: "linear-gradient(135deg, #E81828 0%, #b3122a 50%, #284898 130%)",
  },
  sixers: {
    key: "sixers",
    name: "76ers",
    fullName: "Philadelphia 76ers",
    sport: "basketball",
    emoji: "🏀",
    color: "#006BB6",
    glow: "#60a5fa",
    gradient: "linear-gradient(135deg, #006BB6 0%, #0a4f8f 50%, #ED174C 135%)",
  },
  temple: {
    key: "temple",
    name: "Temple",
    fullName: "Temple Owls Football",
    sport: "football",
    emoji: "🏈",
    color: "#9D2235",
    glow: "#f472b6",
    gradient: "linear-gradient(135deg, #9D2235 0%, #7a1a2a 55%, #A7A9AC 140%)",
  },
};

export const TEAM_ORDER: TeamKey[] = ["eagles", "phillies", "sixers", "temple"];

export const SPORT_EMOJI: Record<Sport, string> = {
  football: "🏈",
  baseball: "⚾",
  basketball: "🏀",
};

export function isTeamKey(value: unknown): value is TeamKey {
  return typeof value === "string" && value in TEAMS;
}

// Finds the team for a game or saved plan. Prefers an explicit key.
export function teamFor(game: {
  team?: unknown;
  name?: string;
  venue?: string | { name?: string };
} | null | undefined): Team | null {
  if (!game) return null;
  if (isTeamKey(game.team)) return TEAMS[game.team];
  const venue = typeof game.venue === "string" ? game.venue : game.venue?.name;
  const { team } = teamAndSport(game.name, venue);
  return team ? TEAMS[team] : null;
}

// Neutral fallback so every card still gets a look when a team is unknown.
export const NEUTRAL_TEAM = {
  emoji: "🎟️",
  color: "#155e63",
  glow: "#5eead4",
  gradient: "linear-gradient(135deg, #0e3b43 0%, #155e63 50%, #312e81 130%)",
};

export function teamLook(team: Team | null) {
  return team ?? NEUTRAL_TEAM;
}

// Ticketmaster names can be messy ("Preseason: New York Knicks v",
// "Tampa Bay Rays: Fan Appreciation Day"). Display-only cleanup: returns the
// opponent plus an optional tag like "Preseason".
export function cleanOpponent(raw: string) {
  let text = raw.trim();
  let tag: string | undefined;
  const prefix = text.match(/^(preseason|playoffs?|exhibition|spring training)\s*:\s*/i);
  if (prefix) {
    tag = prefix[1].replace(/^\w/, char => char.toUpperCase());
    text = text.slice(prefix[0].length);
  }
  text = text.replace(/\s+(v|vs\.?)$/i, "");
  const versus = text.split(/\s+vs?\.?\s+/i);
  if (versus.length > 1) text = versus[versus.length - 1];
  if (!tag) {
    const suffix = text.match(/^(.+?):\s*(.+)$/);
    if (suffix) { text = suffix[1]; tag = suffix[2]; }
  }
  text = text.replace(/\s+football$/i, "").trim();
  return { opponent: text, tag };
}

// Tidies a full matchup name like "Philadelphia 76ers vs. Preseason: New York Knicks v".
export function tidyMatchup(name: string) {
  const parts = name.split(/\s+vs?\.?\s+/i);
  if (parts.length < 2) return cleanOpponent(name).opponent || name;
  const home = parts[0].replace(/^temple university owls football$/i, "Temple Owls").replace(/\s+football$/i, "").trim();
  const { opponent } = cleanOpponent(parts.slice(1).join(" vs. "));
  return `${home} vs. ${opponent}`;
}
