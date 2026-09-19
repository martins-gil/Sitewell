import { getCurrentUser } from "@/lib/queries";
import { MfaSettings } from "./mfa-settings";
import { ChangePasswordForm } from "./change-password-form";
import { getT } from "@/lib/i18n/server";

export default async function SecuritySettingsPage() {
  const t = await getT();
  const user = await getCurrentUser();

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Security")}</h1>
        <p className="mt-1 text-sm text-neutral-500">{user.email}</p>
      </div>
      <ChangePasswordForm />
      <MfaSettings initialEnabled={user.mfaEnabled} />
    </div>
  );
}
