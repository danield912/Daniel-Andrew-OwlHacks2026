"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Mail, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/gp/button";
import { InlineAlert } from "@/components/gp/states";
import { SuccessCheck } from "@/components/gp/confetti";
import { Field } from "@/components/auth/fields";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center" role="status">
      <SuccessCheck size={64} />
      <p className="mt-4 font-semibold text-white">Check your email 📬</p>
      <p className="mt-1 text-slate-400">If {email} has an account, we sent a link to reset your password.</p>
      <Link href="/auth/login" className="mt-5 inline-block font-semibold text-mint-300 hover:text-mint-200">Back to sign in</Link>
    </motion.div>;
  }

  return <form onSubmit={handleForgotPassword} className="space-y-5">
    <Field id="email" label="Email" type="email" placeholder="you@example.com" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} icon={<Mail size={17} aria-hidden="true" />} />
    <AnimatePresence>{error && <InlineAlert tone="error">{error}</InlineAlert>}</AnimatePresence>
    <Button type="submit" size="lg" className="w-full" loading={isLoading} loadingText="Sending…" icon={<Send size={17} aria-hidden="true" />}>Send reset link</Button>
  </form>;
}
