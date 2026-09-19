import type { SubjectStatus } from "@prisma/client";
import Link from "next/link";
import { getSubjects, getStudies, getDuplicationSources } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/badge";
import { AddPatientForm } from "./add-patient-form";

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
          <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {subjects.length} subject{subjects.length === 1 ? "" : "s"} matching current filters
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
          <option value="">All studies</option>
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
          <option value="">All stages</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Subject</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Initials / name</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Study</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Stage</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">I/E criteria</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {subjects.map((subject) => {
              const criteria = subject.ieCriteriaSnapshot as
                | { criterion: string; met: boolean | null }[]
                | null;
              return (
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
                  <td className="px-4 py-2">
                    {criteria && criteria.length > 0 ? (
                      <ul className="space-y-0.5">
                        {criteria.map((c, i) => (
                          <li
                            key={i}
                            className={
                              c.met === true
                                ? "text-green-700 dark:text-green-400"
                                : c.met === false
                                  ? "text-red-700 dark:text-red-400"
                                  : "text-neutral-500"
                            }
                          >
                            {c.met === true ? "✓" : c.met === false ? "✗" : "○"} {c.criterion}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
                    {formatDate(subject.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
