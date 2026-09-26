import type { Team } from "@/lib/team-style";
import { teamLook } from "@/lib/team-style";
import { cn } from "@/lib/utils";

export function TeamBadge({ team, className, size = "md" }: { team: Team | null; className?: string; size?: "sm" | "md" }) {
  const look = teamLook(team);
  return <span
    className={cn("inline-flex items-center gap-1.5 rounded-full font-semibold text-white ring-1 ring-white/15", size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm", className)}
    style={{ background: look.gradient }}
  >
    <span aria-hidden="true">{look.emoji}</span>{team?.name ?? "Game"}
  </span>;
}

// Rounded emoji "app icon" in team colors.
export function TeamIcon({ team, className }: { team: Team | null; className?: string }) {
  const look = teamLook(team);
  return <span
    aria-hidden="true"
    className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl shadow-lg ring-1 ring-white/15", className)}
    style={{ background: look.gradient, boxShadow: `0 10px 30px -10px ${look.glow}` }}
  >{look.emoji}</span>;
}
