import { AuthShell } from "@/components/auth-shell";
import { getT } from "@/lib/i18n/server";
import { RequestAccessForm } from "./request-access-form";

export default async function RequestAccessPage() {
  const t = await getT();
  return (
    <AuthShell
      title={t("Request access")}
      subtitle={t("Tell us who you are and the administrator will set up your account.")}
    >
      <RequestAccessForm />
    </AuthShell>
  );
}
