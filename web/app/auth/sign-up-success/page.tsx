import { AuthLayout } from "@/components/auth/auth-layout";
import { ButtonLink } from "@/components/gp/button";

export default function Page() {
  return <AuthLayout title="Check your email 📬" subtitle="One more step before game day.">
    <p className="text-slate-300">We sent you a confirmation link. Open it on this device to finish creating your account. If you were joining a friend’s plan, the link brings you right back to it.</p>
    <p className="mt-3 text-sm text-slate-500">No email after a minute? Check your spam folder.</p>
    <ButtonLink href="/auth/login" variant="secondary" className="mt-6 w-full">Back to sign in</ButtonLink>
  </AuthLayout>;
}
