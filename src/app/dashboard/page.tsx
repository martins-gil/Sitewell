import Link from "next/link";
import {
  getSubjectFunnelStats,
  getUpcomingVisits,
  getUpcomingWeeks,
  getStudies,
  getExpiringDocuments,
  getKitExpirySummary,
} from "@/lib/queries";
import { formatDayShort, humanizeEnum } from "@/lib/format";
import { patientTone, resolveStudyColors } from "@/lib/study-colors";
import { getT } from "@/lib/i18n/server";

export default async function DashboardOverviewPage() {
  const t = await getT();
  const [funnel, visitsNextWeek, upcomingVisits, expiringDocs, kitSummary, weeks, studies] = await Promise.all([
    getSubjectFunnelStats(),
    getUpcomingVisits(7),
    getUpcomingVisits(14),
    getExpiringDocuments(60),
    getKitExpirySummary(),
    getUpcomingWeeks(),
    getStudies(),
  ]);
  const colors = resolveStudyColors(studies);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Overview")}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t("All data below is synthetic pilot-testing data.")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Link href="/dashboard/subjects" className="rounded-lg border border-neutral-200 p-5 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
          <div className="text-sm text-neutral-500">{t("Patients in funnel")}</div>
          <div className="mt-1 text-3xl font-semibold">{funnel.total}</div>
          <div className="mt-1 text-xs text-neutral-500">{t("{0}% enrolled", [funnel.conversionRate])}</div>
        </Link>
        <Link href="/dashboard/visits" className="rounded-lg border border-neutral-200 p-5 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
          <div className="text-sm text-neutral-500">{t("Visits next week")}</div>
          <div className="mt-1 text-3xl font-semibold">{visitsNextWeek.length}</div>
        </Link>
        <Link href="/dashboard/visits" className="rounded-lg border border-neutral-200 p-5 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
          <div className="text-sm text-neutral-500">{t("Visits in next 14 days")}</div>
          <div className="mt-1 text-3xl font-semibold">{upcomingVisits.length}</div>
        </Link>
        <Link href="/dashboard/documents" className="rounded-lg border border-neutral-200 p-5 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
          <div className="text-sm text-neutral-500">{t("Documents expiring in 60 days")}</div>
          <div className="mt-1 text-3xl font-semibold">{expiringDocs.length}</div>
        </Link>
        <Link href="/dashboard/kits" className="rounded-lg border border-neutral-200 p-5 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
          <div className="text-sm text-neutral-500">{t("Kits expiring in 2 months")}</div>
          <div className="mt-1 text-3xl font-semibold">{kitSummary.expiringSoon}</div>
          {kitSummary.expired > 0 && (
            <div className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
              {t("+ {0} already expired", [kitSummary.expired])}</div>
          )}
        </Link>
      </div>

      <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="mb-3 text-sm font-medium text-neutral-500">{t("Funnel by stage")}</h2>
        <div className="flex flex-wrap gap-4">
          {Object.entries(funnel.byStatus).map(([status, count]) => (
            <div key={status} className="min-w-[7rem]">
              <div className="text-xs text-neutral-500">{t(humanizeEnum(status))}</div>
              <div className="text-xl font-semibold">{count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="mb-3 text-sm font-medium text-neutral-500">{t("Upcoming visits")}</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {[
            {
              key: "this",
              heading: t("This week: {0} visit|This week: {0} visits", [weeks.thisWeek.length]),
              empty: t("Nothing scheduled for the rest of this week."),
              visits: weeks.thisWeek,
            },
            {
              key: "next",
              heading: t("Next week: {0} visit|Next week: {0} visits", [weeks.nextWeek.length]),
              empty: t("Nothing scheduled next week."),
              visits: weeks.nextWeek,
            },
          ].map((group) => (
            <div key={group.key}>
              <h3 className="mb-1 text-sm font-medium">{group.heading}</h3>
              {group.visits.length === 0 ? (
                <p className="text-sm text-neutral-500">{group.empty}</p>
              ) : (
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {group.visits.slice(0, 8).map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <Link href={`/dashboard/visits/${v.id}`} className="flex items-center gap-2 hover:underline">
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: patientTone(colors[v.studyId] ?? "blue", v.subject.subjectCode) }}
                        />
                        <span>
                          {v.subject.subjectCode} · {v.visitType} · {v.study.protocolId}
                        </span>
                      </Link>
                      <span className="shrink-0 text-neutral-500">{formatDayShort(v.targetDate, t.locale)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {group.visits.length > 8 && (
                <Link href="/dashboard/visits" className="mt-1 inline-block text-sm underline">
                  {t("+{0} more", [group.visits.length - 8])}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
