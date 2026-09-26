import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ButtonLink } from "@/components/gp/button";

async function ErrorContent({ searchParams }: { searchParams: Promise<{ error: string }> }) {
  const params = await searchParams;
  return <p className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-4 text-sm text-amber-100">
    {params?.error ? `Details: ${params.error}` : "An unspecified error occurred."}
  </p>;
}

export default function Page({ searchParams }: { searchParams: Promise<{ error: string }> }) {
  return <AuthLayout title="That link didn’t work" subtitle="It may have expired or already been used.">
    <Suspense><ErrorContent searchParams={searchParams} /></Suspense>
    <div className="mt-6 flex flex-wrap gap-3">
      <ButtonLink href="/auth/login">Sign in</ButtonLink>
      <ButtonLink href="/auth/forgot-password" variant="secondary">Reset password</ButtonLink>
    </div>
  </AuthLayout>;
}
