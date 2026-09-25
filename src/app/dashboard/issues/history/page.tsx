import Link from "next/link";
import { getResolvedIssues } from "@/lib/pending-issues";
import { getStudies } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { resolveStudyColors } from "@/lib/study-colors";
import { getT } from "@/lib/i18n/server";
import { IssueHistory, type MonthGroup, type ResolvedIssueRow } from "./history-list";

function startOfWeek(d: Date): Date {
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
}

export default async function IssuesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ studyId?: string }>;
}) {
  const t = await getT();
  const params = await searchParams;
  const dateLocale = t.locale === "en" ? "en-US" : t.locale;

  const [issues, studies] = await Promise.all([getResolvedIssues({ studyId: params.studyId }), getStudies()]);
  const colors = resolveStudyColors(studies);

  // Grouped by month, then — inside each month — by week (Monday to Sunday, in UTC, the
  // same convention as the rest of the app), newest first throughout.
  const months = new Map<string, Map<string, { weekStart: Date; issues: ResolvedIssueRow[] }>>();
  for (const issue of issues) {
    const resolvedAt = issue.resolvedAt ?? issue.updatedAt;
    const monthKey = `${resolvedAt.getUTCFullYear()}-${String(resolvedAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const weekStart = startOfWeek(resolvedAt);
    const weekKey = weekStart.toISOString().slice(0, 10);

    if (!months.has(monthKey)) months.set(monthKey, new Map());
    const weeks = months.get(monthKey)!;
    if (!weeks.has(weekKey)) weeks.set(weekKey, { weekStart, issues: [] });
    weeks.get(weekKey)!.issues.push({
      id: issue.id,
      text: issue.text,
      protocolId: issue.study?.protocolId ?? null,
      colorId: issue.studyId ? (colors[issue.studyId] ?? "blue") : null,
      resolvedDateLabel: formatDate(resolvedAt, t.locale),
    });
  }

  const monthGroups: MonthGroup[] = [...months.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, weeks]) => {
      const [year, month] = monthKey.split("-").map(Number);
      const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(dateLocale, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      const weekGroups = [...weeks.values()]
        .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
        .map((w) => {
          const weekEnd = new Date(w.weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
          const weekLabel = `${w.weekStart.toLocaleDateString(dateLocale, { month: "short", day: "numeric", timeZone: "UTC" })} – ${weekEnd.toLocaleDateString(dateLocale, { month: "short", day: "numeric", timeZone: "UTC" })}`;
          return { label: weekLabel, issues: w.issues };
        });
      return { label, weeks: weekGroups };
    });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/issues" className="text-sm text-neutral-500 hover:underline">
            {"← "}{t("Pending issues")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("Issues history")}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {t("Every resolved issue, grouped by the week and month it was sorted out.")}
          </p>
        </div>
      </div>

      <form className="flex flex-wrap items-center gap-3" method="get">
        <select
          name="studyId"
          defaultValue={params.studyId ?? ""}
          aria-label={t("Study")}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">{t("All studies")}</option>
          {studies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.protocolId}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {t("Filter")}</button>
      </form>

      <IssueHistory months={monthGroups} />
    </div>
  );
}
