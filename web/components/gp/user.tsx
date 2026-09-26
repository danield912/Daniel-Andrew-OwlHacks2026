"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Game-day defaults a person can set on the Account page. They prefill the
// planning form. Stored in the Supabase user's own metadata.
export type GameDayDefaults = {
  travelMode?: "Transit" | "Driving";
  budget?: string;
  pregame?: string;
  origin?: string;
};

type UserState =
  | { status: "loading"; user: null }
  | { status: "signed-out"; user: null }
  | { status: "signed-in"; user: User };

type UserApi = UserState & {
  name: string;
  email: string;
  initials: string;
  defaults: GameDayDefaults;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const UserContext = createContext<UserApi | null>(null);

// Same order as the database's plan_display_name(): full_name, name, email prefix.
export function displayName(user: User | null) {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const pick = [meta.full_name, meta.name].find(value => typeof value === "string" && value.trim());
  return (pick as string | undefined)?.trim() || user?.email?.split("@")[0] || "";
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UserState>({ status: "loading", user: null });

  const refresh = useCallback(async () => {
    const { data } = await createClient().auth.getUser();
    setState(data.user ? { status: "signed-in", user: data.user } : { status: "signed-out", user: null });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    refresh();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session?.user ? { status: "signed-in", user: session.user } : { status: "signed-out", user: null });
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await createClient().auth.signOut();
    setState({ status: "signed-out", user: null });
  }, []);

  const api = useMemo<UserApi>(() => {
    const name = displayName(state.user);
    const meta = (state.user?.user_metadata ?? {}) as Record<string, unknown>;
    const defaults = (meta.gp_defaults && typeof meta.gp_defaults === "object" ? meta.gp_defaults : {}) as GameDayDefaults;
    return { ...state, name, email: state.user?.email ?? "", initials: initialsOf(name), defaults, refresh, signOut };
  }, [state, refresh, signOut]);

  return <UserContext.Provider value={api}>{children}</UserContext.Provider>;
}

export function useUser() {
  const api = useContext(UserContext);
  if (!api) throw new Error("useUser must be used inside UserProvider");
  return api;
}
