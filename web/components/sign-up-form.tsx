"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { ArrowRight, Lock, Mail, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/gp/button";
import { InlineAlert } from "@/components/gp/states";
import { Field, PasswordField, safeNext } from "@/components/auth/fields";

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const mismatch = repeatPassword.length > 0 && password !== repeatPassword;

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== repeatPassword) {
      setError("Passwords don’t match.");
      return;
    }
    setIsLoading(true);
    try {
      const next = safeNext(new URLSearchParams(window.location.search).get("next"));
      const { error } = await createClient().auth.signUp({
        email,
        password,
        options: {
          // The name is shown to friends in shared plans.
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}${next}`,
        },
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return <form onSubmit={handleSignUp} className="space-y-5">
    <Field id="name" label="Your name" placeholder="What your crew calls you" required maxLength={60} autoComplete="name" value={name} onChange={event => setName(event.target.value)} icon={<UserRound size={17} aria-hidden="true" />} hint="Friends see this name in shared plans." />
    <Field id="email" label="Email" type="email" placeholder="you@example.com" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} icon={<Mail size={17} aria-hidden="true" />} />
    <PasswordField id="password" label="Password" required minLength={6} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} icon={<Lock size={17} aria-hidden="true" />} hint="At least 6 characters." />
    <PasswordField id="repeat-password" label="Repeat password" required autoComplete="new-password" value={repeatPassword} onChange={event => setRepeatPassword(event.target.value)} icon={<Lock size={17} aria-hidden="true" />} aria-invalid={mismatch} hint={mismatch ? <span className="text-amber-200">Passwords don’t match yet.</span> : undefined} />
    <AnimatePresence>{error && <InlineAlert tone="error">{error}</InlineAlert>}</AnimatePresence>
    <Button type="submit" size="lg" className="w-full" loading={isLoading} loadingText="Creating account…" iconRight={<ArrowRight size={18} aria-hidden="true" />}>Create account</Button>
  </form>;
}
