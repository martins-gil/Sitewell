import { aiConfigured } from "@/lib/ai";
import { helpArticles } from "@/lib/help/articles";
import { getT } from "@/lib/i18n/server";
import { HelpCenter } from "./help-center";

export default async function HelpPage() {
  const t = await getT();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Help")}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t("Step-by-step answers to what coordinators ask most — or ask in your own words.")}
        </p>
      </div>
      <HelpCenter articles={helpArticles(t)} aiEnabled={aiConfigured()} />
    </div>
  );
}
