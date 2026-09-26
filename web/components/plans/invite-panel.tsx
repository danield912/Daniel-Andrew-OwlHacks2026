"use client";
import { useRef, useState } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { plansRequest, planTime } from "@/lib/saved-plans";
import { actionClass, panelClass } from "./shared";

export function InvitePanel({ planId }: { planId: string }) {
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const linkInput = useRef<HTMLInputElement>(null);

  async function createInvite() {
    setCreating(true);
    setError("");
    try {
      const data = await plansRequest(`/api/plans/${encodeURIComponent(planId)}/invites`, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
      });
      if (typeof data.invite?.token !== "string") {
        throw new Error("The server did not return an invite link. Please try again.");
      }
      setLink(`${window.location.origin}/invite/${encodeURIComponent(data.invite.token)}`);
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
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard can be blocked; select the text so the user can copy it manually.
      linkInput.current?.select();
      setError("Couldn’t copy automatically. The link is selected — press Command + C.");
    }
  }

  return <section aria-labelledby="invite-heading" className={panelClass}>
    <h2 id="invite-heading" className="text-2xl font-bold">Invite friends</h2>
    <p className="mt-2 text-sm text-slate-400">Anyone with the link can join this plan after signing in.</p>

    {link ? <div className="mt-5 space-y-3">
      <label htmlFor="invite-link" className="text-sm font-medium">Invite link</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="invite-link"
          ref={linkInput}
          readOnly
          value={link}
          onFocus={(event) => event.target.select()}
          className="w-full min-w-0 rounded-xl border border-white/15 bg-[#14272d] px-4 py-3 text-sm text-white"
        />
        <button type="button" onClick={copyLink} className={actionClass}>
          {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      <p role="status" className="text-xs text-slate-400">
        {copied ? "Link copied. Send it to your crew." : expiresAt ? `Link expires ${planTime(expiresAt)}.` : ""}
      </p>
    </div> : <button type="button" disabled={creating} onClick={createInvite} className={`${actionClass} mt-5`}>
      <UserPlus size={18} aria-hidden="true" />{creating ? "Creating link…" : "Invite friends"}
    </button>}

    {error && <p role="alert" className="mt-4 rounded-xl bg-amber-200/10 p-4 text-sm text-amber-100">{error}</p>}
  </section>;
}
