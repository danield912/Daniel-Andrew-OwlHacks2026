"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Trash2 } from "lucide-react";
import type { PlanRole } from "@/lib/saved-plans";
import { Button } from "@/components/gp/button";
import { Modal } from "@/components/gp/modal";
import { InlineAlert } from "@/components/gp/states";

async function planActionRequest(path: string, init: RequestInit, fallback: string) {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("This action isn’t connected yet. Please try again once the API is ready.");
  }
  const data = await response.json();
  if (response.status === 401) throw new Error("Please sign in again, then retry.");
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

export function PlanActions({ planId, role }: { planId: string; role: PlanRole }) {
  const isLeader = role === "leader";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const copy = isLeader
    ? {
        heading: "Delete plan",
        description: "Removes this plan for everyone in it, including their invite links.",
        button: "Delete plan",
        confirmTitle: "Delete this plan for everyone?",
        confirmBody: "This can’t be undone. Everyone in the plan will lose access.",
        confirm: "Delete",
        working: "Deleting…",
        failed: "We couldn’t delete this plan. Please try again.",
        notice: "deleted",
      }
    : {
        heading: "Leave plan",
        description: "Removes this plan from your Joined list. Everyone else keeps it.",
        button: "Leave plan",
        confirmTitle: "Leave this plan?",
        confirmBody: "You’ll need a new invite link to rejoin.",
        confirm: "Leave",
        working: "Leaving…",
        failed: "We couldn’t remove you from this plan. Please try again.",
        notice: "left",
      };

  async function confirm() {
    setWorking(true);
    setError("");
    try {
      await planActionRequest(`/api/plans/${encodeURIComponent(planId)}${isLeader ? "" : "/leave"}`, {
        method: isLeader ? "DELETE" : "POST",
        signal: AbortSignal.timeout(15000),
      }, copy.failed);
      setOpen(false);
      router.push(`/plans?notice=${copy.notice}`);
    } catch (caught) {
      setError(caught instanceof Error && caught.name === "TimeoutError"
        ? "That took too long. Check My Plans, then try again if the plan is still there."
        : caught instanceof Error ? caught.message : copy.failed);
      setWorking(false);
    }
  }

  const Icon = isLeader ? Trash2 : LogOut;

  return <section aria-labelledby="plan-actions-heading" className="rounded-3xl border border-rose-400/15 bg-rose-500/[0.03] p-5 sm:p-6">
    <h2 id="plan-actions-heading" className="font-display text-lg font-bold text-white">{copy.heading}</h2>
    <p className="mt-1 text-sm text-slate-400">{copy.description}</p>
    <Button
      variant={isLeader ? "danger" : "outline-danger"}
      size="sm"
      className="mt-4"
      icon={<Icon size={16} aria-hidden="true" />}
      onClick={() => { setError(""); setOpen(true); }}
    >{copy.button}</Button>

    <Modal
      open={open}
      onClose={() => setOpen(false)}
      locked={working}
      tone="danger"
      title={copy.confirmTitle}
      description={copy.confirmBody}
    >
      {error && <InlineAlert tone="error" className="mb-4">{error}</InlineAlert>}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" disabled={working} onClick={() => setOpen(false)} data-autofocus>Cancel</Button>
        <Button variant="danger" loading={working} loadingText={copy.working} onClick={confirm} icon={<Icon size={16} aria-hidden="true" />}>{copy.confirm}</Button>
      </div>
    </Modal>
  </section>;
}
