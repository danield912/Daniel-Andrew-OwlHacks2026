"use client";
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowRight, CalendarDays, LogIn, MapPin, UserPlus } from "lucide-react";
import { planTime, type InvitePreview } from "@/lib/saved-plans";
import { teamFor, teamLook, tidyMatchup } from "@/lib/team-style";
import { AppShell } from "@/components/gp/app-shell";
import { Button, ButtonLink } from "@/components/gp/button";
import { ConfettiBurst, SuccessCheck } from "@/components/gp/confetti";
import { InlineAlert, Skeleton } from "@/components/gp/states";
import { CountdownBadge } from "@/components/gp/countdown";

type InviteState =
  | { kind: "loading" }
  | { kind: "signed-out"; invite?: InvitePreview }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "error"; message: string }
  | { kind: "preview"; invite: InvitePreview }
  | { kind: "already-member"; planId: string; planTitle: string }
  | { kind: "joined"; planId: string; planTitle: string; invite: InvitePreview };

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

// The invite, drawn as a game ticket with a torn-off stub.
function Ticket({ invite, children }: { invite?: InvitePreview; children: ReactNode }) {
  const team = invite ? teamFor({ name: invite.game.name, venue: invite.game.venue }) : null;
  const look = teamLook(team);
  return <motion.div
    initial={{ opacity: 0, y: 30, rotateX: 25, rotateZ: -2 }}
    animate={{ opacity: 1, y: 0, rotateX: 0, rotateZ: 0 }}
    transition={{ type: "spring", stiffness: 120, damping: 16 }}
    style={{ transformPerspective: 1000 }}
    className="relative mx-auto w-full max-w-xl"
  >
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-night-800/80 shadow-lift backdrop-blur-xl">
      <div className="relative h-40 overflow-hidden" style={{ background: look.gradient }}>
        <div className="gp-yardlines absolute inset-0 opacity-60" aria-hidden="true" />
        <motion.span
          aria-hidden="true"
          animate={{ rotate: [-14, -4, -14], y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-4 -top-8 text-[160px] leading-none opacity-30"
        >{look.emoji}</motion.span>
        <div className="absolute bottom-4 left-6 flex items-center gap-2">
          <span className="rounded-full bg-black/30 px-3 py-1 font-score text-sm font-bold uppercase tracking-[0.25em] text-white backdrop-blur">Admit one · Your crew</span>
        </div>
      </div>
      {/* perforation */}
      <div className="relative h-0" aria-hidden="true">
        <span className="absolute -left-4 -top-4 h-8 w-8 rounded-full bg-night-900" />
        <span className="absolute -right-4 -top-4 h-8 w-8 rounded-full bg-night-900" />
        <span className="absolute inset-x-6 top-0 border-t-2 border-dashed border-white/15" />
      </div>
      <div className="p-6 sm:p-8">{children}</div>
    </div>
  </motion.div>;
}

function InviteDetails({ invite }: { invite: InvitePreview }) {
  return <>
    <p className="text-sm font-semibold text-mint-300">🎉 {invite.invitedBy} invited you</p>
    <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-white">{tidyMatchup(invite.game.name)}</h1>
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-300">
      <span className="flex items-center gap-2"><CalendarDays size={17} aria-hidden="true" />{planTime(invite.game.startsAt)}</span>
      <span className="flex items-center gap-2"><MapPin size={17} aria-hidden="true" />{invite.game.venue.name}</span>
      <CountdownBadge startsAt={invite.game.startsAt} />
    </div>
  </>;
}

function Message({ emoji, title, body, children }: { emoji: string; title: string; body: string; children: ReactNode }) {
  return <div className="text-center">
    <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14 }} className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/[0.06] text-3xl" aria-hidden="true">{emoji}</motion.div>
    <h1 className="mt-4 font-display text-2xl font-bold text-white">{title}</h1>
    <p className="mx-auto mt-2 max-w-sm text-slate-300">{body}</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>
  </div>;
}

export function InviteView({ token }: { token: string }) {
  const [state, setState] = useState<InviteState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const invitePath = `/api/invites/${encodeURIComponent(token)}`;
  const signInHref = `/auth/login?next=${encodeURIComponent(`/invite/${token}`)}`;
  const signUpHref = `/auth/sign-up?next=${encodeURIComponent(`/invite/${token}`)}`;

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
      const data = await inviteRequest(`${invitePath}/accept`, { method: "POST", signal: AbortSignal.timeout(15000) });
      const planId = typeof data.plan?.id === "string" ? data.plan.id : invite.planId;
      setState(data.joined === false
        ? { kind: "already-member", planId, planTitle: invite.planTitle }
        : { kind: "joined", planId, planTitle: invite.planTitle, invite });
    } catch (caught) {
      const next = stateForError(caught);
      if (next.kind === "error") setJoinError(next.message);
      else setState(next.kind === "signed-out" ? { kind: "signed-out", invite } : next);
    } finally {
      setJoining(false);
    }
  }

  const planHref = (planId: string) => `/plans/${encodeURIComponent(planId)}`;

  return <AppShell>
    <div className="py-4 sm:py-10">
      {state.kind === "loading" ? <Ticket>
        <div role="status" className="space-y-3"><span className="sr-only">Opening invite…</span><Skeleton className="h-4 w-40" /><Skeleton className="h-9 w-4/5" /><Skeleton className="h-5 w-3/5" /><Skeleton className="mt-6 h-14 w-full" /></div>
      </Ticket> :

      state.kind === "signed-out" ? <Ticket invite={state.invite}>
        {state.invite && <div className="mb-6"><InviteDetails invite={state.invite} /></div>}
        <Message emoji="🔐" title="Sign in to join this plan" body="You’ve been invited to a Philly GamePlan outing. Sign in or create a free account, and you’ll come right back here.">
          <ButtonLink href={signInHref} icon={<LogIn size={17} aria-hidden="true" />}>Sign in</ButtonLink>
          <ButtonLink href={signUpHref} variant="secondary">Create an account</ButtonLink>
        </Message>
      </Ticket> :

      state.kind === "invalid" ? <Ticket>
        <Message emoji="🤔" title="This invite link doesn’t work" body="Check that you copied the whole link, or ask your friend to send a new one.">
          <ButtonLink href="/plans" variant="secondary">Go to My Plans</ButtonLink>
        </Message>
      </Ticket> :

      state.kind === "expired" ? <Ticket>
        <Message emoji="⌛" title="This invite has expired" body="Ask the plan’s leader to send you a fresh invite link.">
          <ButtonLink href="/plans" variant="secondary">Go to My Plans</ButtonLink>
        </Message>
      </Ticket> :

      state.kind === "error" ? <Ticket>
        <Message emoji="📡" title="We couldn’t open this invite" body={state.message}>
          <Button onClick={() => setAttempt(n => n + 1)}>Try again</Button>
        </Message>
      </Ticket> :

      state.kind === "already-member" ? <Ticket>
        <Message emoji="👋" title="You’re already in this plan" body={`${state.planTitle} is already in your plans.`}>
          <ButtonLink href={planHref(state.planId)} iconRight={<ArrowRight size={17} aria-hidden="true" />}>Open plan</ButtonLink>
        </Message>
      </Ticket> :

      state.kind === "joined" ? <Ticket invite={state.invite}>
        <div className="text-center" role="status">
          <span className="relative inline-block"><SuccessCheck size={72} /><ConfettiBurst pieces={40} /></span>
          <h1 className="mt-4 font-display text-3xl font-extrabold text-white">You’re in! 🎉</h1>
          <p className="mx-auto mt-2 max-w-sm text-slate-300">You joined {state.planTitle}. Next, add where you’re coming from so you get your own leave time and a pin on the crew map.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href={`${planHref(state.planId)}?welcome=1`} iconRight={<ArrowRight size={17} aria-hidden="true" />}>Add my starting point</ButtonLink>
            <ButtonLink href="/plans" variant="secondary">My Plans</ButtonLink>
          </div>
        </div>
      </Ticket> :

      <Ticket invite={state.invite}>
        <InviteDetails invite={state.invite} />
        <Button size="lg" className="mt-7 w-full" loading={joining} loadingText="Joining…" onClick={() => join(state.invite)} icon={<UserPlus size={19} aria-hidden="true" />}>
          Join plan
        </Button>
        {joinError && <InlineAlert tone="error" className="mt-4">{joinError}</InlineAlert>}
        <p className="mt-5 text-center text-xs text-slate-500">
          All times in Philadelphia time.{state.invite.expiresAt ? ` Invite expires ${planTime(state.invite.expiresAt)}.` : ""}
        </p>
      </Ticket>}
    </div>
  </AppShell>;
}
