"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Share2, UserPlus } from "lucide-react";
import { plansRequest, planTime } from "@/lib/saved-plans";
import { siteUrl } from "@/lib/site-url";
import { Button } from "@/components/gp/button";
import { InlineAlert } from "@/components/gp/states";
import { useToast } from "@/components/gp/toast";

export function InvitePanel({ planId }: { planId: string }) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const linkInput = useRef<HTMLInputElement>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function createInvite() {
    setCreating(true);
    setError("");
    try {
      const data = await plansRequest(`/api/plans/${encodeURIComponent(planId)}/invites`, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
      });
      if (typeof data.invite?.token !== "string") throw new Error("The server did not return an invite link. Please try again.");
      setLink(`${siteUrl() ?? window.location.origin}/invite/${encodeURIComponent(data.invite.token)}`);
      setExpiresAt(typeof data.invite.expiresAt === "string" ? data.invite.expiresAt : "");
      setCopied(false);
    } catch (caught) {
      setError(caught instanceof Error && caught.name === "TimeoutError"
        ? "Creating the invite timed out. Please try again."
        : caught instanceof Error ? caught.message : "We couldn’t create an invite link.");
    } finally {
      setCreating(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied ✓");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      linkInput.current?.select();
      toast.info("Link selected. Press ⌘C to copy.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Join my Philly GamePlan", text: "Join my game-day plan 🏟️", url: link });
    } catch { /* user closed the share sheet */ }
  }

  return <section aria-labelledby="invite-heading" className="relative overflow-hidden rounded-3xl border border-mint-300/20 bg-gradient-to-br from-mint-300/[0.12] via-night-800/80 to-indigo-500/[0.12] p-5 shadow-lift sm:p-6">
    <motion.span aria-hidden="true" animate={{ rotate: [0, 12, -8, 0], y: [0, -4, 0] }} transition={{ duration: 5, repeat: Infinity }} className="absolute -right-2 -top-3 text-6xl opacity-30">🎟️</motion.span>
    <h2 id="invite-heading" className="font-display text-xl font-bold text-white">Bring your crew</h2>
    <p className="mt-1 text-sm text-slate-300">Anyone with the link can join after signing in.</p>

    <AnimatePresence mode="wait" initial={false}>
      {link ? <motion.div key="link" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
        <label htmlFor="invite-link" className="sr-only">Invite link</label>
        <input
          id="invite-link"
          ref={linkInput}
          readOnly
          value={link}
          onFocus={event => event.target.select()}
          className="gp-input font-mono text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={copyLink} size="sm" icon={copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}>{copied ? "Copied!" : "Copy link"}</Button>
          {canShare && <Button onClick={share} size="sm" variant="secondary" icon={<Share2 size={16} aria-hidden="true" />}>Share</Button>}
        </div>
        {expiresAt && <p className="text-xs text-slate-400">Link expires {planTime(expiresAt)}.</p>}
      </motion.div> : <motion.div key="create" exit={{ opacity: 0 }} className="mt-4">
        <Button loading={creating} loadingText="Creating link…" onClick={createInvite} icon={<UserPlus size={18} aria-hidden="true" />}>Invite friends</Button>
      </motion.div>}
    </AnimatePresence>

    {error && <InlineAlert tone="error" className="mt-4">{error}</InlineAlert>}
  </section>;
}
