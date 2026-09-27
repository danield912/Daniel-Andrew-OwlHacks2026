"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Bell, Clock3, Radio, Send, X } from "lucide-react";
import { LATE_REASONS, alertHeadline, clock, timeAgo, type LateAlert } from "@/lib/live-client";
import { Button } from "@/components/gp/button";
import { Modal } from "@/components/gp/modal";
import { SegmentedTabs } from "@/components/gp/tabs";
import { InlineAlert } from "@/components/gp/states";
import { useToast } from "@/components/gp/toast";
import type { Live } from "./use-live";

type Minutes = "5" | "15" | "30";

// "I'm running late": pick why and roughly how late; the crew gets notified.
export function RunningLateButton({ live, size = "md" }: { live: Live; size?: "sm" | "md" }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof LATE_REASONS)[number]["id"]>("train");
  const [minutes, setMinutes] = useState<Minutes>("15");
  const [extra, setExtra] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setSending(true);
    setError("");
    const picked = LATE_REASONS.find(item => item.id === reason)!;
    const note = [picked.note, extra.trim()].filter(Boolean).join(" · ").slice(0, 140);
    try {
      await live.sendLate(Number(minutes) as 5 | 15 | 30, note);
      setOpen(false);
      setExtra("");
      toast.success({ title: "We let your crew know 👍", body: `${picked.label} · ~${minutes} min late` });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t send your alert.");
    } finally {
      setSending(false);
    }
  }

  return <>
    <Button variant="outline-danger" size={size} icon={<Clock3 size={16} aria-hidden="true" />} onClick={() => { setError(""); setOpen(true); }}>I’m running late</Button>
    <Modal open={open} onClose={() => setOpen(false)} locked={sending} title="Running late?" description="Your crew gets a notification with your reason and new ETA.">
      <div className="space-y-5">
        <fieldset>
          <legend className="gp-label">What happened?</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-2">
            {LATE_REASONS.map(item => <motion.button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={reason === item.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => setReason(item.id)}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition-colors ${reason === item.id ? "border-amber-300/60 bg-amber-300/10 text-white" : "border-white/10 text-slate-300 hover:border-white/25"}`}
            ><span className="text-xl" aria-hidden="true">{item.emoji}</span>{item.label}</motion.button>)}
          </div>
        </fieldset>
        <div>
          <p className="gp-label">About how late?</p>
          <SegmentedTabs<Minutes>
            label="Minutes late"
            value={minutes}
            onChange={setMinutes}
            fill
            options={[{ value: "5", label: "5 min" }, { value: "15", label: "15 min" }, { value: "30", label: "30+ min" }]}
          />
        </div>
        <div>
          <label htmlFor="late-note" className="gp-label">Anything else? <span className="font-normal text-slate-500">(optional)</span></label>
          <input id="late-note" maxLength={100} value={extra} onChange={event => setExtra(event.target.value)} placeholder="e.g. catching the next B1" className="gp-input" />
        </div>
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" disabled={sending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={sending} loadingText="Sending…" onClick={send} icon={<Send size={16} aria-hidden="true" />}>Tell my crew</Button>
        </div>
      </div>
    </Modal>
  </>;
}

// Controls above the map: share your location, notifications, running late.
export function LiveBar({ live }: { live: Live }) {
  const sharingCount = live.locations.length;
  if (!live.connected || live.state === "unknown") return null;

  if (live.state !== "open") {
    return <p className="mb-4 flex items-start gap-2 rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
      <Radio size={16} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
      {live.state === "before"
        ? `Live locations open on game day at ${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(live.window!.startsAt))}, 3 hours before arrival. For now the map shows where everyone’s starting from.`
        : "Live location sharing has ended for this game."}
    </p>;
  }

  const on = live.share === "on" || live.share === "asking";
  return <div className="mb-4 space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      {on
        ? <Button variant="secondary" size="sm" onClick={live.stopSharing} icon={<span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-mint-300" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-mint-300" /></span>}>
          {live.share === "asking" ? "Finding you…" : "Sharing live · Stop"}
        </Button>
        : <Button size="sm" onClick={live.startSharing} icon={<Radio size={16} aria-hidden="true" />}>Share my location</Button>}
      {live.permission === "default" && <Button variant="secondary" size="sm" onClick={live.enableNotifications} icon={<Bell size={15} aria-hidden="true" />}>Turn on notifications</Button>}
      <RunningLateButton live={live} size="sm" />
      <span className="ml-auto text-xs text-slate-400">📡 {sharingCount} {sharingCount === 1 ? "person" : "people"} sharing live</span>
    </div>
    {!on && live.share === "off" && <p className="text-xs text-slate-500">Only people in this plan see your live spot. It updates while this page is open and stops when you leave.</p>}
    {live.shareError && <InlineAlert tone="warning">{live.shareError}</InlineAlert>}
  </div>;
}

function AlertRow({ alert, now, onOpen, onDismiss }: { alert: LateAlert; now: number; onOpen?: () => void; onDismiss?: () => void }) {
  const serious = alert.minutesLate >= 15;
  return <motion.li
    layout
    initial={{ opacity: 0, y: -10, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, x: 30, height: 0 }}
    className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${serious ? "border-rose-400/30 bg-rose-500/[0.08]" : "border-amber-300/30 bg-amber-300/[0.07]"}`}
  >
    <motion.span
      animate={{ rotate: [0, -12, 12, -8, 0] }}
      transition={{ duration: 0.8, repeat: 2 }}
      className={serious ? "text-rose-300" : "text-amber-300"}
      aria-hidden="true"
    ><AlertTriangle size={20} /></motion.span>
    <div className="min-w-0 flex-1">
      <p className="font-semibold text-white">{alert.isYou ? `We let your crew know you might be ~${alert.minutesLate} min late` : alertHeadline(alert)}</p>
      <p className="text-sm text-slate-300">
        {[alert.note, alert.eta ? `New ETA ${clock(alert.eta)}` : "", timeAgo(alert.createdAt, now)].filter(Boolean).join(" · ")}
      </p>
    </div>
    {onOpen && <Button variant="secondary" size="sm" onClick={onOpen}>See their trip</Button>}
    {onDismiss && <Button variant="ghost" size="sm" onClick={onDismiss} icon={<X size={15} aria-hidden="true" />}>I’m on my way</Button>}
  </motion.li>;
}

// Top-of-page banner: who might be late and why.
export function LateBanner({ live, onOpenMember }: { live: Live; onOpenMember: (userId: string) => void }) {
  const toast = useToast();
  const latest = [...live.latestAlert.values()];
  if (!latest.length) return null;
  return <section aria-label="Running late" className="space-y-2">
    <ul className="space-y-2">
      <AnimatePresence initial={false}>
        {latest.map(alert => <AlertRow
          key={alert.id}
          alert={alert}
          now={live.now}
          onOpen={alert.isYou ? undefined : () => onOpenMember(alert.userId)}
          onDismiss={alert.isYou ? async () => {
            try { await live.dismiss(alert.id); toast.success("Glad you’re on your way 🙌"); }
            catch (caught) { toast.error(caught instanceof Error ? caught.message : "We couldn’t dismiss this alert."); }
          } : undefined}
        />)}
      </AnimatePresence>
    </ul>
  </section>;
}
