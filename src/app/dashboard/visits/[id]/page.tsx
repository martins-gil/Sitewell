import { notFound } from "next/navigation";
import Link from "next/link";
import { getVisitById, getVisitChecklist } from "@/lib/queries";
import { formatDate, humanizeEnum } from "@/lib/format";
import { getDocumentDisplayStatus } from "@/lib/document-status";
import { Badge } from "@/components/badge";
import { VisitUploadForm } from "./visit-upload-form";
import { VisitChecklist } from "./checklist";

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [visit, checklist] = await Promise.all([getVisitById(id), getVisitChecklist(id)]);
  if (!visit) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/visits" className="text-sm text-neutral-500 hover:underline">
          ← Visits
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{visit.visitType}</h1>
          <Badge value={visit.status} />
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          <Link href={`/dashboard/subjects/${visit.subject.id}`} className="font-mono hover:underline">
            {visit.subject.subjectCode}
          </Link>{" "}
          · {visit.study.protocolId} — {visit.study.title}
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 p-5 text-sm dark:border-neutral-800">
        <dl className="grid grid-cols-2 gap-y-2">
          <dt className="text-neutral-500">Target date</dt>
          <dd>{formatDate(visit.targetDate)}</dd>
          <dt className="text-neutral-500">Window</dt>
          <dd>
            {formatDate(visit.windowStart)} – {formatDate(visit.windowEnd)}
          </dd>
          <dt className="text-neutral-500">Actual date</dt>
          <dd>{formatDate(visit.actualDate)}</dd>
        </dl>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-neutral-500">Procedure checklist</h2>
        <VisitChecklist visitId={visit.id} items={checklist} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-neutral-500">
          Documents for this visit {visit.documents.length > 0 && `(${visit.documents.length})`}
        </h2>
        <VisitUploadForm studyId={visit.studyId} visitId={visit.id} />

        {visit.documents.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">No documents uploaded for this visit yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-neutral-500">Title</th>
                  <th className="px-4 py-2 text-left font-medium text-neutral-500">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-neutral-500">Version</th>
                  <th className="px-4 py-2 text-left font-medium text-neutral-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {visit.documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="whitespace-nowrap px-4 py-2">
                      <a
                        href={doc.fileUrl.startsWith("http") ? doc.fileUrl : `/api/documents/${doc.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {doc.title}
                      </a>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{humanizeEnum(doc.type)}</td>
                    <td className="whitespace-nowrap px-4 py-2">{doc.version}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <Badge value={getDocumentDisplayStatus(doc)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
