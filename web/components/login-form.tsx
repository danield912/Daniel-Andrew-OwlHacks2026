"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/gp/button";
import { InlineAlert } from "@/components/gp/states";
import { useToast } from "@/components/gp/toast";
import { Field, PasswordField, safeNext } from "@/components/auth/fields";

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await createClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back 👋");
      // Return to the page that sent the user here (e.g. an invite link).
      router.push(safeNext(new URLSearchParams(window.location.search).get("next")));
      router.refresh();
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : "An error occurred";
      setError(/invalid login/i.test(message) ? "That email and password don’t match. Try again or reset your password." : message);
    } finally {
      setIsLoading(false);
    }
  };

  return <form onSubmit={handleLogin} className="space-y-5" noValidate={false}>
    <Field id="email" label="Email" type="email" placeholder="you@example.com" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} icon={<Mail size={17} aria-hidden="true" />} />
    <PasswordField
      id="password"
      label="Password"
      required
      autoComplete="current-password"
      value={password}
      onChange={event => setPassword(event.target.value)}
      icon={<Lock size={17} aria-hidden="true" />}
      action={<Link href="/auth/forgot-password" className="mb-2 text-sm font-semibold text-mint-300 hover:text-mint-200">Forgot password?</Link>}
    />
    <AnimatePresence>{error && <InlineAlert tone="error">{error}</InlineAlert>}</AnimatePresence>
    <Button type="submit" size="lg" className="w-full" loading={isLoading} loadingText="Signing in…" iconRight={<ArrowRight size={18} aria-hidden="true" />}>Sign in</Button>
  </form>;
}
