import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/login-form";

export default function Page() {
  return <AuthLayout
    title="Welcome back"
    subtitle="Sign in to see your plans and your crew."
    footer={<>New here? <Link href="/auth/sign-up" className="font-semibold text-mint-300 hover:text-mint-200">Create a free account</Link></>}
  ><LoginForm /></AuthLayout>;
}
