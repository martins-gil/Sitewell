import Link from "next/link";
import {
  getSubjectFunnelStats,
  getUpcomingVisits,
  getUpcomingWeeks,
  getWeekLoad,
  getStudies,
  getExpiringDocuments,
  getKitExpirySummary,
} from "@/lib/queries";
import { formatDayShort, humanizeEnum } from "@/lib/format";
import { patientTone, resolveStudyColors } from "@/lib/study-colors";
import { getT } from "@/lib/i18n/server";
import { NavIcon, type NavIconName } from "@/components/nav-icons";

// The funnel's stages in order, each with its bar colour.
const STAGES: { status: string; bar: string }[] = [
  { status: "IDENTIFIED", bar: "bg-slate-400" },
  { status: "PRE_SCREENED", bar: "bg-sky-400" },
  { status: "SCREENED", bar: "bg-blue-500" },
  { status: "CONSENTED", bar: "bg-violet-500" },
  { status: "ENROLLED", bar: "bg-emerald-500" },
  { status: "SCREEN_FAILED", bar: "bg-amber-500" },
  { status: "WITHDRAWN", bar: "bg-rose-400" },
];

const tileClass =
  "group flex flex-col rounded-lg border border-neutral-200 p-5 hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800";

function Tile({
  href,
  icon,
  label,
  value,
  note,
  noteTone,
}: {
  href: string;
  icon: NavIconName;
  label: string;
  value: number;
  note?: string;
  noteTone?: "alert";
}) {
  return (
    <Link href={href} className={tileClass}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
        <NavIcon name={icon} className="h-5 w-5" />
      </span>
      <div className="mt-4 text-sm text-neutral-500">{label}</div>
      <div className="mt-1 text-4xl font-semibold tracking-tight">{value}</div>
      {note && (
        <div className={`mt-1 text-xs ${noteTone === "alert" ? "font-medium text-red-600 dark:text-red-400" : "text-neutral-500"}`}>
          {note}
        </div>
      )}
    </Link>
  );
}

export default async function DashboardOverviewPage() {
  const t = await getT();
  const [funnel, visitsNextWeek, upcomingVisits, expiringDocs, kitSummary, weeks, studies, weekLoad] = await Promise.all([
    getSubjectFunnelStats(),
    getUpcomingVisits(7),
    getUpcomingVisits(14),
    getExpiringDocuments(60),
    getKitExpirySummary(),
    getUpcomingWeeks(),
    getStudies(),
    getWeekLoad(),
  ]);
  const colors = resolveStudyColors(studies);
  const dateLocale = t.locale === "en" ? "en-US" : t.locale;

  const weekTotal = weekLoad.reduce((n, d) => n + d.visits + d.monitoring, 0);
  const busiest = Math.max(1, ...weekLoad.map((d) => d.visits + d.monitoring));
  const stageTotal = Math.max(1, funnel.total);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800 xl:col-span-2">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{t("Overview")}</h1>
            <p className="mt-1 text-sm text-neutral-500">
              {formatDayShort(weekLoad[0].date, t.locale)} — {formatDayShort(weekLoad[6].date, t.locale)}
            </p>
            <p className="mt-2 text-xs text-neutral-400">{t("All data below is synthetic pilot-testing data.")}</p>
          </div>
        </div>
        <Link
          href="/dashboard/subjects"
          className="flex items-center justify-between rounded-lg bg-accent-soft p-6 hover:brightness-95 dark:hover:brightness-110"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div>
            <div className="text-sm text-neutral-600 dark:text-neutral-300">{t("Patients in funnel")}</div>
            <div className="mt-1 text-4xl font-semibold tracking-tight">{funnel.total}</div>
            <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">{t("{0}% enrolled", [funnel.conversionRate])}</div>
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-accent dark:bg-neutral-900">
            <NavIcon name="patients" className="h-6 w-6" />
          </span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800 xl:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{t("Visits this week")}</h2>
              <p className="text-sm text-neutral-500">{t("{0} visit in total|{0} visits in total", [weekTotal])}</p>
            </div>
            <Link href="/dashboard/visits" className="text-sm font-medium text-accent hover:underline">
              {t("Open the calendar →")}
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-2 sm:gap-4">
            {weekLoad.map((d) => {
              const total = d.visits + d.monitoring;
              return (
                <div key={d.date.toISOString()} className="flex flex-col items-center gap-2">
                  <span className={`text-sm font-medium ${total === 0 ? "text-neutral-300 dark:text-neutral-700" : ""}`}>{total}</span>
                  <div
                    className={`relative flex h-36 w-full max-w-[3.5rem] flex-col justify-end overflow-hidden rounded-xl ${
                      d.isToday ? "bg-sky-100 dark:bg-sky-950" : "bg-neutral-100 dark:bg-neutral-800/60"
                    }`}
                  >
                    {d.monitoring > 0 && (
                      <div className="w-full bg-violet-400" style={{ height: `${(d.monitoring / busiest) * 100}%` }} />
                    )}
                    {d.visits > 0 && (
                      <div className="w-full bg-sky-500" style={{ height: `${(d.visits / busiest) * 100}%` }} />
                    )}
                  </div>
                  <div className="text-center leading-tight">
                    <div className={`text-xs ${d.isToday ? "font-semibold text-accent" : "text-neutral-500"}`}>
                      {d.date.toLocaleDateString(dateLocale, { weekday: "short", timeZone: "UTC" })}
                    </div>
                    <div className={`text-[11px] ${d.isToday ? "font-semibold text-accent" : "text-neutral-400"}`}>
                      {d.date.getUTCDate()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" />
              {t("Patient visits")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-400" />
              {t("Monitoring visits")}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">{t("Funnel by stage")}</h2>
          <ul className="mt-4 space-y-3">
            {STAGES.map((s) => {
              const count = funnel.byStatus[s.status] ?? 0;
              return (
                <li key={s.status}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-300">{t(humanizeEnum(s.status))}</span>
                    <span className="font-semibold tabular-nums">{count}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${(count / stageTotal) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile href="/dashboard/visits" icon="calendar" label={t("Visits next week")} value={visitsNextWeek.length} />
        <Tile href="/dashboard/visits" icon="calendar" label={t("Visits in next 14 days")} value={upcomingVisits.length} />
        <Tile href="/dashboard/documents" icon="documents" label={t("Documents expiring in 60 days")} value={expiringDocs.length} />
        <Tile
          href="/dashboard/kits"
          icon="kits"
          label={t("Kits expiring in 2 months")}
          value={kitSummary.expiringSoon}
          note={kitSummary.expired > 0 ? t("+ {0} already expired", [kitSummary.expired]) : undefined}
          noteTone="alert"
        />
      </div>

      <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">{t("Upcoming visits")}</h2>
        <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2">
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
              <h3 className="mb-2 text-sm font-medium text-neutral-500">{group.heading}</h3>
              {group.visits.length === 0 ? (
                <p className="text-sm text-neutral-500">{group.empty}</p>
              ) : (
                <ul className="space-y-1.5">
                  {group.visits.slice(0, 8).map((v) => (
                    <li key={v.id}>
                      <Link
                        href={`/dashboard/visits/${v.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: patientTone(colors[v.studyId] ?? "blue", v.subject.subjectCode) }}
                          />
                          <span className="truncate">
                            <span className="font-mono text-xs">{v.subject.subjectCode}</span> · {v.visitType} · {v.study.protocolId}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                          {formatDayShort(v.targetDate, t.locale)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {group.visits.length > 8 && (
                <Link href="/dashboard/visits" className="mt-2 inline-block text-sm font-medium text-accent hover:underline">
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
