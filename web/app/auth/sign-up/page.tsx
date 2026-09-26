import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SignUpForm } from "@/components/sign-up-form";

export default function Page() {
  return <AuthLayout
    title="Join the crew"
    subtitle="Free forever. Plan game days and share them with friends."
    footer={<>Already have an account? <Link href="/auth/login" className="font-semibold text-mint-300 hover:text-mint-200">Sign in</Link></>}
  ><SignUpForm /></AuthLayout>;
}
