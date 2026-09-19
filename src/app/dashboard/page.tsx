import Link from "next/link";
import {
  getSubjectFunnelStats,
  getUpcomingVisits,
  getExpiringDocuments,
  getKitExpirySummary,
} from "@/lib/queries";
import { formatDate, humanizeEnum } from "@/lib/format";

export default async function DashboardOverviewPage() {
  const [funnel, visitsNextWeek, upcomingVisits, expiringDocs, kitSummary] = await Promise.all([
    getSubjectFunnelStats(),
    getUpcomingVisits(7),
    getUpcomingVisits(14),
    getExpiringDocuments(60),
    getKitExpirySummary(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-neutral-500">
          All data below is synthetic pilot-testing data.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Link href="/dashboard/subjects" className="rounded-lg border border-neutral-200 p-5 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
          <div className="text-sm text-neutral-500">Patients in funnel</div>
          <div className="mt-1 text-3xl font-semibold">{funnel.total}</div>
          <div className="mt-1 text-xs text-neutral-500">{funnel.conversionRate}% enrolled</div>
        </Link>
        <Link href="/dashboard/visits" className="rounded-lg border border-neutral-200 p-5 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
          <div className="text-sm text-neutral-500">Visits next week</div>
          <div className="mt-1 text-3xl font-semibold">{visitsNextWeek.length}</div>
        </Link>
        <Link href="/dashboard/visits" className="rounded-lg border border-neutral-200 p-5 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
          <div className="text-sm text-neutral-500">Visits in next 14 days</div>
          <div className="mt-1 text-3xl font-semibold">{upcomingVisits.length}</div>
        </Link>
        <Link href="/dashboard/documents" className="rounded-lg border border-neutral-200 p-5 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
          <div className="text-sm text-neutral-500">Documents expiring in 60 days</div>
          <div className="mt-1 text-3xl font-semibold">{expiringDocs.length}</div>
        </Link>
        <Link href="/dashboard/kits" className="rounded-lg border border-neutral-200 p-5 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
          <div className="text-sm text-neutral-500">Kits expiring in 2 months</div>
          <div className="mt-1 text-3xl font-semibold">{kitSummary.expiringSoon}</div>
          {kitSummary.expired > 0 && (
            <div className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
              + {kitSummary.expired} already expired
            </div>
          )}
        </Link>
      </div>

      <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="mb-3 text-sm font-medium text-neutral-500">Funnel by stage</h2>
        <div className="flex flex-wrap gap-4">
          {Object.entries(funnel.byStatus).map(([status, count]) => (
            <div key={status} className="min-w-[7rem]">
              <div className="text-xs text-neutral-500">{humanizeEnum(status)}</div>
              <div className="text-xl font-semibold">{count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="mb-3 text-sm font-medium text-neutral-500">Upcoming visits</h2>
        {upcomingVisits.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing scheduled in the next two weeks.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {upcomingVisits.slice(0, 6).map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {v.subject.subjectCode} · {v.visitType} · {v.study.protocolId}
                </span>
                <span className="text-neutral-500">{formatDate(v.targetDate)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
