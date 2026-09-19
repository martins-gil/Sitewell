import Link from "next/link";
import { auth } from "@/auth";
import { getStudiesOverview } from "@/lib/queries";
import { humanizeEnum } from "@/lib/format";
import { firstFreeStudyColor, resolveStudyColors, studyColor } from "@/lib/study-colors";
import { AddStudyForm } from "./add-study-form";
import { getT } from "@/lib/i18n/server";

const th = "px-4 py-2 text-left font-medium text-neutral-500";

export default async function StudiesPage() {
  const t = await getT();
  const [session, overview] = await Promise.all([auth(), getStudiesOverview()]);
  const canManage = session?.user?.role === "ORG_ADMIN" || session?.user?.isPlatformAdmin;
  const { rows, totals, byDepartment, departments } = overview;
  const colors = resolveStudyColors(rows);

  const cards = [
    { label: t("Active studies"), value: `${totals.activeStudies}/${totals.studies}` },
    { label: t("Enrolled in {0}", [overview.year]), value: String(totals.enrolledThisYear) },
    { label: t("Currently enrolled"), value: String(totals.enrolledNow) },
    { label: t("Departments"), value: String(departments.length) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Studies")}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t("{0} study.|{0} studies.", [rows.length])}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="text-sm text-neutral-500">{card.label}</div>
            <div className="mt-1 text-3xl font-semibold">{card.value}</div>
          </div>
        ))}
      </div>

      {byDepartment.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-neutral-500">{t("By department")}</h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  <th className={th}>{t("Department")}</th>
                  <th className={th}>{t("Active studies")}</th>
                  <th className={th}>{t("Studies")}</th>
                  <th className={th}>{t("Enrolled in {0}", [overview.year])}</th>
                  <th className={th}>{t("Currently enrolled")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {byDepartment.map((d) => (
                  <tr key={d.id ?? "none"}>
                    <td className="px-4 py-2">{d.id === null ? t("No department") : d.name}</td>
                    <td className="px-4 py-2">{d.activeStudies}</td>
                    <td className="px-4 py-2 text-neutral-500">{d.studies}</td>
                    <td className="px-4 py-2">{d.enrolledThisYear}</td>
                    <td className="px-4 py-2">{d.enrolledNow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canManage && (
        <AddStudyForm departments={departments} defaultColor={firstFreeStudyColor(Object.values(colors))} />
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className={th}>{t("Protocol")}</th>
              <th className={th}>{t("Title")}</th>
              <th className={th}>{t("Department")}</th>
              <th className={th}>{t("Status")}</th>
              <th className={th}>{t("Enrolled in {0}", [overview.year])}</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                  <Link href={`/dashboard/studies/${s.id}`} className="inline-flex items-center gap-2 hover:underline">
                    <span
                      aria-hidden
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: studyColor(colors[s.id] ?? "blue") }}
                    />
                    {s.protocolId}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <Link href={`/dashboard/studies/${s.id}`} className="hover:underline">
                    {s.title}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
                  {s.department?.name ?? t("No department")}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{t(humanizeEnum(s.status))}</td>
                <td className="whitespace-nowrap px-4 py-2">{s.enrolledThisYear}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  <Link
                    href={`/dashboard/studies/${s.id}/templates`}
                    className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
                  >
                    {t("Visit schedule →")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
