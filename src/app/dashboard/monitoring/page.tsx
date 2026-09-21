import Link from "next/link";
import { getStudies } from "@/lib/queries";
import { getMonitoringVisits } from "@/lib/monitoring";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { studyColor, resolveStudyColors } from "@/lib/study-colors";
import { AddMonitoringForm } from "./add-monitoring-form";

export default async function MonitoringVisitsPage() {
  const t = await getT();
  const [visits, studies] = await Promise.all([getMonitoringVisits(), getStudies()]);
  const colors = resolveStudyColors(studies);

  // "Upcoming" starts with today (visit dates are day-only, stored at noon UTC).
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const upcoming = visits.filter((v) => v.visitDate >= todayStart);
  const past = visits.filter((v) => v.visitDate < todayStart).reverse();

  const sources = visits
    .filter((v) => v.pointCount > 0)
    .map((v) => ({
      id: v.id,
      studyId: v.studyId,
      label: `${formatDate(v.visitDate, t.locale)}${v.room ? ` · ${v.room}` : ""}`,
      points: v.pointCount,
    }));

  function table(list: typeof visits) {
    return (
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Date")}</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Time")}</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Study")}</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Room")}</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Points to verify")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {list.map((v) => (
              <tr key={v.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                <td className="whitespace-nowrap px-4 py-2">
                  <Link href={`/dashboard/monitoring/${v.id}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
                    {formatDate(v.visitDate, t.locale)}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-neutral-600 dark:text-neutral-400">{v.startTime ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  <span
                    aria-hidden
                    className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                    style={{ backgroundColor: studyColor(colors[v.studyId] ?? "blue") }}
                  />
                  {v.protocolId}
                </td>
                <td className="whitespace-nowrap px-4 py-2">{v.room ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-2 text-neutral-600 dark:text-neutral-400">
                  {v.pointCount === 0 ? "—" : t("{0} of {1} verified", [v.verifiedCount, v.pointCount])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Monitoring visits")}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {t("Visits from a monitor to the site: when, where, and the points to verify. They also appear on the visit calendar.")}
          </p>
        </div>
      </div>

      <AddMonitoringForm studies={studies.map((s) => ({ id: s.id, protocolId: s.protocolId, title: s.title }))} sources={sources} />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-500">{t("Upcoming")}</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-neutral-400">{t("No monitoring visits planned.")}</p>
        ) : (
          table(upcoming)
        )}
      </section>

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-500">{t("Past")}</h2>
          {table(past)}
        </section>
      )}
    </div>
  );
}
