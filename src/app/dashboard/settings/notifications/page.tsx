import { auth } from "@/auth";
import { emailConfigured } from "@/lib/email";
import { smsConfigured } from "@/lib/sms";
import { getAlertTemplates, getMyNotificationSettings } from "@/lib/notifications";
import { getT } from "@/lib/i18n/server";
import { NotificationsForm } from "./notifications-form";
import { TemplatesForm } from "./templates-form";

export default async function NotificationsSettingsPage() {
  const t = await getT();
  const session = await auth();
  const [mine, wording] = await Promise.all([getMyNotificationSettings(), getAlertTemplates()]);
  const isAdmin = session?.user?.role === "ORG_ADMIN" || session?.user?.isPlatformAdmin;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{t("Notifications")}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t("Choose how you hear about the visits of the coming week.")}
        </p>
      </div>

      <NotificationsForm
        initial={{ phone: mine.phone ?? "", notifyEmail: mine.notifyEmail, notifySms: mine.notifySms }}
        emailProvider={emailConfigured()}
        smsProvider={smsConfigured()}
      />

      {isAdmin && <TemplatesForm templates={wording.templates} custom={wording.custom} />}
    </div>
  );
}
