import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function Page() {
  return <AuthLayout
    title="Reset your password"
    subtitle="Enter your email and we’ll send you a reset link."
    footer={<>Remembered it? <Link href="/auth/login" className="font-semibold text-mint-300 hover:text-mint-200">Sign in</Link></>}
  ><ForgotPasswordForm /></AuthLayout>;
}
