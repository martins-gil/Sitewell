import { LoginForm } from "./login-form";
import { LanguageSelect } from "@/components/language-select";
import { getT } from "@/lib/i18n/server";

export default async function LoginPage() {
  const t = await getT();
  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4 py-16 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">{t("SiteWell-ct")}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {t("Sign in to your organization's workspace")}</p>
        </div>
        <LoginForm />
        <div className="mt-6 flex justify-center">
          <LanguageSelect />
        </div>
      </div>
    </div>
  );
}
