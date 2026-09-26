"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, LogIn, Save } from "lucide-react";
import { plansRequest, type SavePlanInput } from "@/lib/saved-plans";
import { Button, ButtonLink } from "@/components/gp/button";
import { ConfettiBurst, SuccessCheck } from "@/components/gp/confetti";
import { InlineAlert } from "@/components/gp/states";
import { useToast } from "@/components/gp/toast";

export function SavePlanButton({ input }: { input: SavePlanInput }) {
  const toast = useToast();
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
      toast.success({ title: "Plan saved 🎉", body: "Find it anytime under My Plans." });
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
    <AnimatePresence mode="wait" initial={false}>
      {savedId ? <motion.div
        key="saved"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative flex flex-wrap items-center gap-4 rounded-2xl border border-mint-300/30 bg-mint-300/[0.08] p-4"
        role="status"
      >
        <span className="relative"><SuccessCheck size={44} /><ConfettiBurst /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">Plan saved</p>
          <p className="text-sm text-slate-300">Add pregame spots and invite your crew next.</p>
        </div>
        <ButtonLink href={`/plans/${encodeURIComponent(savedId)}`} size="md" iconRight={<ArrowRight size={17} aria-hidden="true" />}>Open plan</ButtonLink>
      </motion.div> : <motion.div key="save" exit={{ opacity: 0, scale: 0.95 }}>
        <Button size="lg" className="w-full" loading={saving} loadingText="Saving plan…" icon={<Save size={18} aria-hidden="true" />} onClick={save}>
          Save plan
        </Button>
      </motion.div>}
    </AnimatePresence>
    {error && <InlineAlert tone="error">{error}</InlineAlert>}
    {/sign in/i.test(error) && <div className="flex flex-wrap gap-2">
      <ButtonLink href="/auth/login?next=/" size="sm" icon={<LogIn size={16} aria-hidden="true" />}>Sign in to save</ButtonLink>
      <ButtonLink href="/auth/sign-up?next=/" size="sm" variant="secondary">Create a free account</ButtonLink>
    </div>}
  </div>;
}
