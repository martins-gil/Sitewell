import Link from "next/link";
import { getAllVisits } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/badge";
import { VisitRowActions } from "./visit-row-actions";
import { SendRemindersButton } from "./send-reminders-button";

export default async function VisitsPage() {
  const visits = await getAllVisits();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visits</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {visits.length} visit{visits.length === 1 ? "" : "s"} across all studies. Calendar
            view is still a flat list — Phase 2 hardening item.
          </p>
        </div>
        <SendRemindersButton />
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Subject</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Study</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Visit</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Target date</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Window</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Actual date</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Status</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {visits.map((v) => (
              <tr key={v.id}>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                  <Link href={`/dashboard/subjects/${v.subjectId}`} className="hover:underline">
                    {v.subject.subjectCode}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2">{v.study.protocolId}</td>
                <td className="whitespace-nowrap px-4 py-2">{v.visitType}</td>
                <td className="whitespace-nowrap px-4 py-2">{formatDate(v.targetDate)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
                  {formatDate(v.windowStart)} – {formatDate(v.windowEnd)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{formatDate(v.actualDate)}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  <Badge value={v.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-2">
                  <VisitRowActions visitId={v.id} status={v.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
