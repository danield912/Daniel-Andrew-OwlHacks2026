import { AuthLayout } from "@/components/auth/auth-layout";
import { UpdatePasswordForm } from "@/components/update-password-form";

export default function Page() {
  return <AuthLayout title="Choose a new password" subtitle="You’ll use it next time you sign in.">
    <UpdatePasswordForm />
  </AuthLayout>;
}
