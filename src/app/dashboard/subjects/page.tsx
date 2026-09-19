import type { SubjectStatus } from "@prisma/client";
import Link from "next/link";
import { getSubjects, getStudies, getDuplicationSources } from "@/lib/queries";
import { formatDate, humanizeEnum } from "@/lib/format";
import { Badge } from "@/components/badge";
import { AddPatientForm } from "./add-patient-form";
import { getT } from "@/lib/i18n/server";

const STATUSES: SubjectStatus[] = [
  "IDENTIFIED",
  "PRE_SCREENED",
  "SCREENED",
  "CONSENTED",
  "ENROLLED",
  "SCREEN_FAILED",
  "WITHDRAWN",
];

export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ studyId?: string; status?: string }>;
}) {
  const t = await getT();
  const params = await searchParams;
  const status = STATUSES.includes(params.status as SubjectStatus)
    ? (params.status as SubjectStatus)
    : undefined;

  const [subjects, studies, duplicationSources] = await Promise.all([
    getSubjects({ studyId: params.studyId, status }),
    getStudies(),
    getDuplicationSources(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Patients")}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {t("{0} subject matching current filters|{0} subjects matching current filters", [subjects.length])}
          </p>
        </div>
        <AddPatientForm studies={studies} sources={duplicationSources} />
      </div>

      <form className="flex flex-wrap gap-3" method="get">
        <select
          name="studyId"
          defaultValue={params.studyId ?? ""}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">{t("All studies")}</option>
          {studies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.protocolId} — {s.title}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">{t("All stages")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(humanizeEnum(s))}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {t("Filter")}</button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Subject")}</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Initials / name")}</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Study")}</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Stage")}</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Added")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {/* The I/E criteria are only shown inside the patient's own file. */}
            {subjects.map((subject) => (
              <tr key={subject.id}>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                  <Link href={`/dashboard/subjects/${subject.id}`} className="hover:underline">
                    {subject.subjectCode}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2">{subject.displayName ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-2">{subject.study.protocolId}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  <Badge value={subject.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
                  {formatDate(subject.createdAt, t.locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
