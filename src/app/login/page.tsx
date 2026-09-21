import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { getT } from "@/lib/i18n/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const t = await getT();
  return (
    <AuthShell title={t("Sign in")} subtitle={t("Sign in to your organization's workspace")}>
      <LoginForm />
      <div className="mt-4 flex flex-col items-center gap-1.5 text-sm">
        <Link href="/forgot-password" className="text-neutral-600 hover:underline dark:text-neutral-400">
          {t("Forgot your password?")}
        </Link>
        <Link href="/request-access" className="text-neutral-600 hover:underline dark:text-neutral-400">
          {t("Don't have an account? Request access")}
        </Link>
      </div>
    </AuthShell>
  );
}
