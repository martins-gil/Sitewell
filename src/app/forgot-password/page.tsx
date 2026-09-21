import { AuthShell } from "@/components/auth-shell";
import { getT } from "@/lib/i18n/server";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const t = await getT();
  return (
    <AuthShell
      title={t("Forgot your password?")}
      subtitle={t("Enter the email address of your account and we'll send you a link to choose a new one.")}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
