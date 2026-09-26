"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Save } from "lucide-react";
import { plansRequest, type SavePlanInput } from "@/lib/saved-plans";
import { actionClass } from "./shared";

export function SavePlanButton({ input }: { input: SavePlanInput }) {
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);

  async function save() {
    if (inFlight.current || savedId) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const data = await plansRequest("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, clientRequestId: requestId.current }),
        signal: AbortSignal.timeout(15000),
      });
      if (typeof data.plan?.id !== "string") {
        throw new Error("The server did not confirm a saved plan. Please retry.");
      }
      setSavedId(data.plan.id);
    } catch (caught) {
      setError(caught instanceof Error && caught.name === "TimeoutError"
        ? "Saving timed out. Retry to check or finish saving this same plan."
        : caught instanceof Error ? caught.message : "We couldn’t save your plan.");
    } finally {
      setSaving(false);
      inFlight.current = false;
    }
  }

  return <div className="space-y-3">
    {savedId ? <div role="status" className="flex flex-wrap items-center gap-4 text-teal-200">
      <span className="flex items-center gap-2"><CheckCircle2 aria-hidden="true" size={20} />Plan saved</span>
      <Link className={actionClass} href={`/plans/${encodeURIComponent(savedId)}`}>View saved plan</Link>
    </div> : <button type="button" disabled={saving} onClick={save} className={actionClass}>
      <Save size={18} aria-hidden="true" />{saving ? "Saving plan…" : "Save plan"}
    </button>}
    {error && <p role="alert" className="rounded-xl bg-amber-200/10 p-4 text-sm text-amber-100">{error}</p>}
  </div>;
}
