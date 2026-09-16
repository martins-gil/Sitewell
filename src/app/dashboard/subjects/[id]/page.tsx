import { notFound } from "next/navigation";
import Link from "next/link";
import { getSubjectById } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/badge";
import { StatusControl } from "./status-control";

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const subject = await getSubjectById(id);
  if (!subject) notFound();

  const criteria = subject.ieCriteriaSnapshot as { criterion: string; met: boolean }[] | null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/subjects" className="text-sm text-neutral-500 hover:underline">
          ← Recruitment
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{subject.subjectCode}</h1>
          <Badge value={subject.status} />
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {subject.study.protocolId} — {subject.study.title}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="mb-3 text-sm font-medium text-neutral-500">Funnel stage</h2>
          <StatusControl subjectId={subject.id} currentStatus={subject.status} />
          {subject.enrolledAt && (
            <p className="mt-3 text-xs text-neutral-500">Enrolled {formatDate(subject.enrolledAt)}</p>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="mb-3 text-sm font-medium text-neutral-500">I/E criteria</h2>
          {criteria && criteria.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {criteria.map((c, i) => (
                <li
                  key={i}
                  className={c.met ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}
                >
                  {c.met ? "✓" : "✗"} {c.criterion}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-400">No criteria recorded.</p>
          )}
          <p className="mt-3 text-xs text-neutral-500">
            Referral source: {subject.referralSource ?? "—"}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
          <h2 className="text-sm font-medium text-neutral-500">
            Visits {subject.visits.length > 0 && `(${subject.visits.length})`}
          </h2>
        </div>
        {subject.visits.length === 0 ? (
          <p className="px-5 py-4 text-sm text-neutral-500">
            No visits yet — generated automatically when the subject is marked Enrolled.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
            <thead className="bg-neutral-50 dark:bg-neutral-900">
              <tr>
                <th className="px-5 py-2 text-left font-medium text-neutral-500">Visit</th>
                <th className="px-5 py-2 text-left font-medium text-neutral-500">Target date</th>
                <th className="px-5 py-2 text-left font-medium text-neutral-500">Window</th>
                <th className="px-5 py-2 text-left font-medium text-neutral-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {subject.visits.map((v) => (
                <tr key={v.id}>
                  <td className="px-5 py-2">{v.visitType}</td>
                  <td className="px-5 py-2">{formatDate(v.targetDate)}</td>
                  <td className="px-5 py-2 text-neutral-500">
                    {formatDate(v.windowStart)} – {formatDate(v.windowEnd)}
                  </td>
                  <td className="px-5 py-2">
                    <Badge value={v.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
