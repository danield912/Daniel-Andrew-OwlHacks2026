"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, LinkIcon, MapPin, UserPlus } from "lucide-react";
import { planTime, type InvitePreview } from "@/lib/saved-plans";
import { PlansShell, PlansLoading, panelClass, actionClass } from "@/components/plans/shared";

type InviteState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "error"; message: string }
  | { kind: "preview"; invite: InvitePreview }
  | { kind: "already-member"; planId: string; planTitle: string }
  | { kind: "joined"; planId: string; planTitle: string };

class InviteRequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function inviteRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new InviteRequestError("Invites are not connected yet. Please try again once the invites API is ready.", response.status);
  }
  const data = await response.json();
  if (!response.ok) {
    throw new InviteRequestError(data.error || "Something went wrong with this invite.", response.status);
  }
  return data;
}

function stateForError(caught: unknown): InviteState {
  if (caught instanceof InviteRequestError) {
    if (caught.status === 401) return { kind: "signed-out" };
    if (caught.status === 404) return { kind: "invalid" };
    if (caught.status === 410) return { kind: "expired" };
    return { kind: "error", message: caught.message };
  }
  if (caught instanceof Error && caught.name === "TimeoutError") {
    return { kind: "error", message: "The invite took too long to load. Please try again." };
  }
  return { kind: "error", message: "We couldn’t open this invite. Please try again." };
}

export function InviteView({ token }: { token: string }) {
  const [state, setState] = useState<InviteState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const invitePath = `/api/invites/${encodeURIComponent(token)}`;
  const signInHref = `/auth/login?next=${encodeURIComponent(`/invite/${token}`)}`;

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    inviteRequest(invitePath, { signal: AbortSignal.timeout(15000) })
      .then(data => {
        const invite = data.invite as InvitePreview | undefined;
        if (!invite?.planId || !invite.game) throw new InviteRequestError("The invite response was unexpected.", 500);
        if (!active) return;
        setState(invite.alreadyMember
          ? { kind: "already-member", planId: invite.planId, planTitle: invite.planTitle }
          : { kind: "preview", invite });
      })
      .catch(caught => { if (active) setState(stateForError(caught)); });
    return () => { active = false; };
  }, [invitePath, attempt]);

  async function join(invite: InvitePreview) {
    setJoining(true);
    setJoinError("");
    try {
      const data = await inviteRequest(`${invitePath}/accept`, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
      });
      const planId = typeof data.plan?.id === "string" ? data.plan.id : invite.planId;
      setState(data.joined === false
        ? { kind: "already-member", planId, planTitle: invite.planTitle }
        : { kind: "joined", planId, planTitle: invite.planTitle });
    } catch (caught) {
      const next = stateForError(caught);
      if (next.kind === "error") setJoinError(next.message);
      else setState(next);
    } finally {
      setJoining(false);
    }
  }

  return <PlansShell>
    {state.kind === "loading" ? <PlansLoading /> :

    state.kind === "signed-out" ? <Message
      title="Sign in to join this plan"
      body="You’ve been invited to a Philly GamePlan outing. Sign in to see the plan and join your crew."
    >
      <Link href={signInHref} className={actionClass}>Sign in</Link>
      <Link href="/auth/sign-up" className="underline">Create an account</Link>
      <p className="w-full text-xs text-slate-400">New here? After you confirm your email, open this invite link again.</p>
    </Message> :

    state.kind === "invalid" ? <Message
      title="This invite link doesn’t work"
      body="Check that you copied the whole link, or ask your friend to send a new one."
    >
      <Link href="/plans" className={actionClass}>Go to My Plans</Link>
    </Message> :

    state.kind === "expired" ? <Message
      title="This invite has expired"
      body="Ask the plan’s leader to send you a fresh invite link."
    >
      <Link href="/plans" className={actionClass}>Go to My Plans</Link>
    </Message> :

    state.kind === "error" ? <Message title="We couldn’t open this invite" body={state.message} alert>
      <button onClick={() => setAttempt(n => n + 1)} className={actionClass}>Try again</button>
    </Message> :

    state.kind === "already-member" ? <Message
      icon
      title="You’re already in this plan"
      body={`${state.planTitle} is already in your plans.`}
    >
      <Link href={`/plans/${encodeURIComponent(state.planId)}`} className={actionClass}>Open plan</Link>
    </Message> :

    state.kind === "joined" ? <Message
      icon
      title="You’re in!"
      body={`You joined ${state.planTitle}. You’ll find it under My Plans → Joined.`}
    >
      <Link href={`/plans/${encodeURIComponent(state.planId)}`} className={actionClass}>Open plan</Link>
      <Link href="/plans" className="underline">My Plans</Link>
    </Message> :

    <section aria-labelledby="invite-title" className={panelClass}>
      <p className="flex items-center gap-2 text-sm font-semibold text-teal-200">
        <LinkIcon size={16} aria-hidden="true" />{state.invite.invitedBy} invited you
      </p>
      <h1 id="invite-title" className="mt-3 text-3xl font-bold sm:text-4xl">{state.invite.planTitle}</h1>
      <p className="mt-3 text-slate-300">{state.invite.game.name}</p>
      <p className="mt-5 flex items-center gap-2 text-sm"><CalendarDays size={16} aria-hidden="true" />{planTime(state.invite.game.startsAt)}</p>
      <p className="mt-3 flex items-center gap-2 text-sm text-slate-300"><MapPin size={16} aria-hidden="true" />{state.invite.game.venue.name}</p>
      <button
        type="button"
        disabled={joining}
        onClick={() => join(state.invite)}
        className={`${actionClass} mt-7`}
      >
        <UserPlus size={18} aria-hidden="true" />{joining ? "Joining…" : "Join plan"}
      </button>
      {joinError && <p role="alert" className="mt-4 rounded-xl bg-amber-200/10 p-4 text-sm text-amber-100">{joinError}</p>}
      <p className="mt-5 text-xs text-slate-400">
        All times in Philadelphia time.{state.invite.expiresAt ? ` Invite expires ${planTime(state.invite.expiresAt)}.` : ""}
      </p>
    </section>}
  </PlansShell>;
}

function Message({ title, body, icon, alert, children }: {
  title: string;
  body: string;
  icon?: boolean;
  alert?: boolean;
  children: React.ReactNode;
}) {
  return <section role={alert ? "alert" : undefined} className={panelClass}>
    {icon && <CheckCircle2 className="mb-3 text-teal-300" aria-hidden="true" />}
    <h1 className={`text-2xl font-bold ${alert ? "text-amber-200" : ""}`}>{title}</h1>
    <p className="mt-3 text-slate-300">{body}</p>
    <div className="mt-6 flex flex-wrap items-center gap-4">{children}</div>
  </section>;
}
