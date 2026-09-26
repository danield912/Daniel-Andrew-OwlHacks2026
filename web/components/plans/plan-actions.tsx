"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Trash2 } from "lucide-react";
import type { PlanRole } from "@/lib/saved-plans";
import { panelClass } from "./shared";

const dangerClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-3 font-semibold text-white transition hover:bg-red-400 disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-300";
const outlineDangerClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/60 px-5 py-3 font-semibold text-red-200 transition hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-300";
const cancelClass = "rounded-xl border border-white/20 px-5 py-3 font-semibold hover:bg-white/10 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300";

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
  const dialog = useRef<HTMLDialogElement>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const copy = isLeader
    ? {
        heading: "Delete plan",
        description: "Deleting removes this plan for everyone in it, including their invite links.",
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
        description: "Leaving removes this plan from your Joined list. Everyone else keeps it.",
        button: "Leave plan",
        confirmTitle: "Leave this plan?",
        confirmBody: "You’ll need a new invite link to rejoin.",
        confirm: "Leave",
        working: "Leaving…",
        failed: "We couldn’t remove you from this plan. Please try again.",
        notice: "left",
      };

  function open() {
    setError("");
    dialog.current?.showModal();
  }

  function close() {
    if (!working) dialog.current?.close();
  }

  async function confirm() {
    setWorking(true);
    setError("");
    const path = `/api/plans/${encodeURIComponent(planId)}${isLeader ? "" : "/leave"}`;
    try {
      await planActionRequest(path, {
        method: isLeader ? "DELETE" : "POST",
        signal: AbortSignal.timeout(15000),
      }, copy.failed);
      dialog.current?.close();
      router.push(`/plans?notice=${copy.notice}`);
    } catch (caught) {
      setError(caught instanceof Error && caught.name === "TimeoutError"
        ? "That took too long. Check My Plans, then try again if the plan is still there."
        : caught instanceof Error ? caught.message : copy.failed);
      setWorking(false);
    }
  }

  return <section aria-labelledby="plan-actions-heading" className={`${panelClass} border-red-400/20`}>
    <h2 id="plan-actions-heading" className="text-xl font-bold">{copy.heading}</h2>
    <p className="mt-2 text-sm text-slate-400">{copy.description}</p>
    <button type="button" onClick={open} className={`${isLeader ? dangerClass : outlineDangerClass} mt-5`}>
      {isLeader ? <Trash2 size={18} aria-hidden="true" /> : <LogOut size={18} aria-hidden="true" />}
      {copy.button}
    </button>

    <dialog
      ref={dialog}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
      onCancel={(event) => { if (working) event.preventDefault(); }}
      onClick={(event) => { if (event.target === dialog.current) close(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-white/10 bg-[#10232a] p-0 text-slate-100 backdrop:bg-black/70"
    >
      <div className="p-6 sm:p-8">
        <h3 id="confirm-title" className="text-xl font-bold">{copy.confirmTitle}</h3>
        <p id="confirm-body" className="mt-3 text-slate-300">{copy.confirmBody}</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-amber-200/10 p-4 text-sm text-amber-100">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" autoFocus disabled={working} onClick={close} className={cancelClass}>Cancel</button>
          <button type="button" disabled={working} onClick={confirm} className={dangerClass}>
            {working ? copy.working : copy.confirm}
          </button>
        </div>
      </div>
    </dialog>
  </section>;
}
