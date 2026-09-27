"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, MoreHorizontal, ShieldCheck, UserMinus, Users } from "lucide-react";
import { ROLE_INFO, planTime, type PlanMember, type PlanRole } from "@/lib/saved-plans";
import { Button } from "@/components/gp/button";
import { Modal } from "@/components/gp/modal";
import { InlineAlert } from "@/components/gp/states";
import { useToast } from "@/components/gp/toast";
import { initialsOf } from "@/components/gp/user";

const roleOrder = { leader: 0, co_leader: 1, member: 2 };
const AVATAR_GRADIENTS = [
  "from-mint-300 to-glow-cyan",
  "from-indigo-400 to-glow-violet",
  "from-amber-300 to-rose-400",
  "from-sky-400 to-indigo-400",
  "from-rose-400 to-fuchsia-400",
];
// Same palette as plain colors, for map pins.
export const AVATAR_COLORS = ["#5eead4", "#a78bfa", "#fbbf24", "#60a5fa", "#f472b6"];

export function avatarIndex(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % AVATAR_GRADIENTS.length;
}

export function Avatar({ member, size = "md" }: { member: Pick<PlanMember, "userId" | "name">; size?: "sm" | "md" }) {
  return <span
    aria-hidden="true"
    className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-night-950 ring-2 ring-night-850 ${AVATAR_GRADIENTS[avatarIndex(member.userId)]} ${size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm"}`}
  >{initialsOf(member.name)}</span>;
}

async function crewRequest(path: string, init: RequestInit, fallback: string) {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error(fallback);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

function startLine(member: PlanMember) {
  if (!member.start) return <span className="text-slate-500">📍 No starting point yet</span>;
  const route = member.start.route;
  return <span className="text-slate-400">
    {member.start.travelMode === "TRANSIT" ? "🚇" : "🚗"} from {member.start.origin}
    {route && <> · leaves {planTime(route.leaveByTime || route.departureTime).replace(/^.*?, /, "")}</>}
  </span>;
}

function MemberMenu({ member, busy, onRole, onRemove }: {
  member: PlanMember;
  busy: boolean;
  onRole: (role: Exclude<PlanRole, "leader">) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const next = member.role === "co_leader" ? "member" : "co_leader";
  return <div ref={wrapper} className="relative">
    <button
      type="button"
      disabled={busy}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={`Manage ${member.name}`}
      onClick={() => setOpen(value => !value)}
      className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
    ><MoreHorizontal size={18} aria-hidden="true" /></button>
    <AnimatePresence>
      {open && <motion.div
        role="menu"
        initial={{ opacity: 0, y: -6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12 } }}
        className="absolute right-0 top-9 z-30 w-56 origin-top-right rounded-2xl border border-white/10 bg-night-800/95 p-1.5 shadow-lift backdrop-blur-xl"
      >
        <button type="button" role="menuitem" onClick={() => { setOpen(false); onRole(next); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/[0.07]">
          <span aria-hidden="true">{ROLE_INFO[next].emoji}</span>Make {ROLE_INFO[next].label.toLowerCase()}
        </button>
        <button type="button" role="menuitem" onClick={() => { setOpen(false); onRemove(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-rose-200 transition hover:bg-rose-500/10">
          <UserMinus size={16} aria-hidden="true" />Remove from plan
        </button>
      </motion.div>}
    </AnimatePresence>
  </div>;
}

export function MembersList({ planId, members, viewerRole, onChange, onSelect }: {
  planId: string;
  members?: PlanMember[];
  viewerRole: PlanRole;
  onChange: (members: PlanMember[]) => void;
  onSelect?: (userId: string) => void; // opens their card (ETA and route)
}) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<PlanMember | null>(null);
  const [removeError, setRemoveError] = useState("");
  const [showRoles, setShowRoles] = useState(false);
  const isLeader = viewerRole === "leader";
  const sorted = [...(members ?? [])].sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.name.localeCompare(b.name));

  async function changeRole(member: PlanMember, role: Exclude<PlanRole, "leader">) {
    setBusyId(member.userId);
    try {
      await crewRequest(`/api/plans/${encodeURIComponent(planId)}/members/${encodeURIComponent(member.userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }, "We couldn’t change that role.");
      onChange((members ?? []).map(item => item.userId === member.userId ? { ...item, role } : item));
      toast.success(`${ROLE_INFO[role].emoji} ${member.name} is now a ${ROLE_INFO[role].label.toLowerCase()}`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "We couldn’t change that role.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusyId(removing.userId);
    setRemoveError("");
    try {
      await crewRequest(`/api/plans/${encodeURIComponent(planId)}/members/${encodeURIComponent(removing.userId)}`, { method: "DELETE" }, "We couldn’t remove them.");
      onChange((members ?? []).filter(item => item.userId !== removing.userId));
      toast.success(`${removing.name} was removed from the plan`);
      setRemoving(null);
    } catch (caught) {
      setRemoveError(caught instanceof Error ? caught.message : "We couldn’t remove them.");
    } finally {
      setBusyId(null);
    }
  }

  return <section aria-labelledby="members-heading" className="gp-panel p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3">
      <h2 id="members-heading" className="flex items-center gap-2 font-display text-xl font-bold text-white">
        <Users size={20} className="text-mint-300" aria-hidden="true" />Your crew
      </h2>
      {sorted.length > 0 && <div className="flex -space-x-2" aria-hidden="true">
        {sorted.slice(0, 4).map(member => <Avatar key={member.userId} member={member} size="sm" />)}
        {sorted.length > 4 && <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs font-bold text-white ring-2 ring-night-850">+{sorted.length - 4}</span>}
      </div>}
    </div>

    {!members ? <p className="mt-3 text-sm text-slate-400">The crew list will appear once group plans are connected.</p> : <ul className="mt-4 space-y-1">
      <AnimatePresence initial={false}>
        {sorted.map(member => <motion.li
          key={member.userId}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: 20, height: 0 }}
          className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-white/[0.04]"
        >
          <button
            type="button"
            onClick={() => onSelect?.(member.userId)}
            aria-label={`See ${member.isYou ? "your" : `${member.name}’s`} trip`}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline focus-visible:outline-mint-300"
          >
          <Avatar member={member} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate font-medium text-white">{member.name}{member.isYou && <span className="text-slate-400"> (you)</span>}</span>
              <motion.span
                key={member.role}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${member.role === "leader" ? "bg-amber-300/15 text-amber-200" : member.role === "co_leader" ? "bg-mint-300/15 text-mint-200" : "bg-white/[0.06] text-slate-300"}`}
              >{ROLE_INFO[member.role].emoji} {ROLE_INFO[member.role].label}</motion.span>
            </p>
            <p className="mt-0.5 truncate text-xs">{startLine(member)}</p>
          </div>
          </button>
          {isLeader && !member.isYou && member.role !== "leader" && <MemberMenu
            member={member}
            busy={busyId === member.userId}
            onRole={role => changeRole(member, role)}
            onRemove={() => { setRemoveError(""); setRemoving(member); }}
          />}
        </motion.li>)}
      </AnimatePresence>
    </ul>}

    <button
      type="button"
      aria-expanded={showRoles}
      onClick={() => setShowRoles(value => !value)}
      className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-slate-400 transition hover:text-white"
    >
      <ShieldCheck size={15} aria-hidden="true" />What can each role do?
      <motion.span animate={{ rotate: showRoles ? 180 : 0 }}><ChevronDown size={15} aria-hidden="true" /></motion.span>
    </button>
    <AnimatePresence initial={false}>
      {showRoles && <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-3 overflow-hidden">
        {(["leader", "co_leader", "member"] as const).map(role => <li key={role} className="rounded-2xl bg-white/[0.03] p-3">
          <p className="font-semibold text-white">{ROLE_INFO[role].emoji} {ROLE_INFO[role].label}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{ROLE_INFO[role].can.join(" · ")}</p>
        </li>)}
        {isLeader && <li className="px-1 text-xs text-slate-500">Use the ⋯ menu next to someone to change their role or remove them.</li>}
      </motion.ul>}
    </AnimatePresence>

    <Modal
      open={Boolean(removing)}
      onClose={() => setRemoving(null)}
      locked={busyId === removing?.userId}
      tone="danger"
      title={`Remove ${removing?.name ?? "them"} from the plan?`}
      description="They’ll lose access right away. You can send them a new invite link later."
    >
      {removeError && <InlineAlert tone="error" className="mb-4">{removeError}</InlineAlert>}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" disabled={busyId === removing?.userId} onClick={() => setRemoving(null)} data-autofocus>Cancel</Button>
        <Button variant="danger" loading={busyId === removing?.userId} loadingText="Removing…" onClick={confirmRemove} icon={<UserMinus size={16} aria-hidden="true" />}>Remove</Button>
      </div>
    </Modal>
  </section>;
}
