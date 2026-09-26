"use client";
import type { ReactNode } from "react";
import { LogIn } from "lucide-react";
import { teamFor } from "@/lib/team-style";
import type { SavedPlan } from "@/lib/saved-plans";
import { AppShell } from "@/components/gp/app-shell";
import { ButtonLink } from "@/components/gp/button";
import { ErrorState, SkeletonCards } from "@/components/gp/states";

// Shared pieces for the plan pages, built on the GamePlan design system.
export const panelClass = "gp-panel p-6 sm:p-8";

export function PlansShell({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

export function PlansLoading({ label = "Loading your plans…" }: { label?: string }) {
  return <SkeletonCards count={3} label={label} />;
}

export function PlansError({ message, retry, title = "We couldn’t load your plans" }: { message: string; retry: () => void; title?: string }) {
  const needsSignIn = /sign in/i.test(message);
  return <ErrorState
    title={needsSignIn ? "Sign in to see your plans" : title}
    message={message}
    onRetry={needsSignIn ? undefined : retry}
    extra={<ButtonLink href="/auth/login" variant={needsSignIn ? "primary" : "ghost"} size="sm" icon={<LogIn size={16} aria-hidden="true" />}>Sign in</ButtonLink>}
  />;
}

export function planTeam(plan: Pick<SavedPlan, "game">) {
  const game = plan.game as SavedPlan["game"] & { team?: unknown };
  return teamFor({ team: game.team, name: game.name, venue: game.venue });
}
