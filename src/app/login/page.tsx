import { AuthShell } from "@/components/auth-shell";
import { getT } from "@/lib/i18n/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const t = await getT();
  return (
    <AuthShell title={t("Sign in")}>
      <LoginForm />
    </AuthShell>
  );
}
