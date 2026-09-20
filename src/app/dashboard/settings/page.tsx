import { getT } from "@/lib/i18n/server";
import { getSectionModes, getSidebarColor, getTheme } from "@/lib/preferences-server";
import { PreferencesForm } from "./preferences-form";

export default async function SettingsPage() {
  const t = await getT();
  const [theme, sectionModes, sidebarColor] = await Promise.all([getTheme(), getSectionModes(), getSidebarColor()]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Preferences")}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t("How SiteWell-ct looks and reads on this browser. These are saved in the browser, so they also apply on the sign-in page, but not on your other devices.")}
        </p>
      </div>
      <PreferencesForm theme={theme} sectionModes={sectionModes} sidebarColor={sidebarColor} />
    </div>
  );
}
