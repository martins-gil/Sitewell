import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { getT } from "@/lib/i18n/server";
import { isResetLinkValid } from "@/lib/password-reset";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const t = await getT();
  const { token = "" } = await searchParams;
  const valid = await isResetLinkValid(token);

  return (
    <AuthShell title={t("Choose a new password")}>
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p>{t("This link has expired or was already used. Ask for a new one.")}</p>
          <Link href="/forgot-password" className="inline-block font-medium hover:underline">
            {t("Get a new link")}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
