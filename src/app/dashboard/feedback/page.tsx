import { getFeedbackSubmissions } from "@/lib/queries";
import { formatDate, humanizeEnum } from "@/lib/format";
import { FeedbackForm } from "./feedback-form";
import { getT } from "@/lib/i18n/server";

export default async function FeedbackPage() {
  const t = await getT();
  const submissions = await getFeedbackSubmissions();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Feedback")}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t("Tell us what's confusing, what broke, or what would make your day-to-day easier. This is the Phase 3.5 pilot-testing loop — everything here goes straight to the team building this.")}</p>
      </div>

      <FeedbackForm />

      <div>
        <h2 className="mb-3 text-sm font-medium text-neutral-500">
          {t("Submitted so far ({0})", [submissions.length])}</h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-neutral-400">{t("Nothing submitted yet.")}</p>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <div key={s.id} className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                  <span>
                    {t("{0} · {1} ({2}) · ease of use {3}/5", [t(humanizeEnum(s.area)), s.submittedBy.name, t(humanizeEnum(s.submittedBy.role)), s.easeOfUseRating])}</span>
                  <span>{formatDate(s.createdAt, t.locale)}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {s.confusing && (
                    <p>
                      <span className="font-medium">{t("Confusing:")}</span> {s.confusing}
                    </p>
                  )}
                  {s.broken && (
                    <p>
                      <span className="font-medium">{t("Broken:")}</span> {s.broken}
                    </p>
                  )}
                  {s.suggestion && (
                    <p>
                      <span className="font-medium">{t("Suggestion:")}</span> {s.suggestion}
                    </p>
                  )}
                  {!s.confusing && !s.broken && !s.suggestion && (
                    <p className="text-neutral-400">{t("No details left.")}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
