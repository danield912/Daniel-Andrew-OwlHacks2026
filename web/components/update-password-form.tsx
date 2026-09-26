"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Lock, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/gp/button";
import { InlineAlert } from "@/components/gp/states";
import { useToast } from "@/components/gp/toast";
import { PasswordField } from "@/components/auth/fields";

export function UpdatePasswordForm() {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated ✓");
      router.push("/plans");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return <form onSubmit={handleUpdate} className="space-y-5">
    <PasswordField id="password" label="New password" required minLength={6} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} icon={<Lock size={17} aria-hidden="true" />} hint="At least 6 characters." />
    <AnimatePresence>{error && <InlineAlert tone="error">{error}</InlineAlert>}</AnimatePresence>
    <Button type="submit" size="lg" className="w-full" loading={isLoading} loadingText="Saving…" icon={<Save size={17} aria-hidden="true" />}>Save new password</Button>
  </form>;
}
