import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getVisitById,
  getVisitChecklist,
  getVisitChecklistHeader,
  getAssignableKitsForStudy,
} from "@/lib/queries";
import { formatDate, humanizeEnum, toDateTimeInput } from "@/lib/format";
import { getDocumentDisplayStatus } from "@/lib/document-status";
import { Badge } from "@/components/badge";
import { VisitUploadForm } from "./visit-upload-form";
import { VisitChecklist } from "./checklist";
import { VisitKits } from "./visit-kits";
import { VisitNotes } from "./visit-notes";
import { DocumentStatusControl } from "@/app/dashboard/documents/document-status-control";
import { VisitDocHeader } from "./visit-doc-header";
import { EditVisitForm } from "./edit-visit-form";
import { DeleteVisitButton } from "./delete-visit-button";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [visit, checklist, docHeader] = await Promise.all([
    getVisitById(id),
    getVisitChecklist(id),
    getVisitChecklistHeader(id),
  ]);
  if (!visit) notFound();
  const availableKits = await getAssignableKitsForStudy(visit.studyId);

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

      <EditVisitForm
        visitId={visit.id}
        values={{
          visitType: visit.visitType,
          isCustom: visit.templateId === null,
          status: visit.status,
          targetLabel: formatDate(visit.targetDate),
          windowLabel: `${formatDate(visit.windowStart)} – ${formatDate(visit.windowEnd)}`,
          actualLabel: formatDate(visit.actualDate),
          targetInput: visit.targetDate.toISOString().slice(0, 10),
          actualInput: visit.actualDate ? visit.actualDate.toISOString().slice(0, 10) : "",
          windowBeforeDays: Math.round((visit.targetDate.getTime() - visit.windowStart.getTime()) / DAY_MS),
          windowAfterDays: Math.round((visit.windowEnd.getTime() - visit.targetDate.getTime()) / DAY_MS),
        }}
      />

      <div>
        <h2 className="mb-3 text-sm font-medium text-neutral-500">Document details (printed on the .docx)</h2>
        <VisitDocHeader
          visitId={visit.id}
          values={{
            studyId: docHeader.studyId,
            hasTemplate: docHeader.hasTemplate,
            piName: docHeader.piName,
            siteNumber: docHeader.siteNumber,
            protocolId: docHeader.protocolId,
            hasProtocolDocument: docHeader.protocolDocumentTitle !== null,
            protocolAwaitingSignature: docHeader.protocolAwaitingSignature,
            protocolVersion: docHeader.protocolVersion,
            protocolReleaseLabel: formatDate(docHeader.protocolReleaseDate),
            protocolReleaseInput: docHeader.protocolReleaseDate
              ? docHeader.protocolReleaseDate.toISOString().slice(0, 10)
              : "",
            checklistVersion: docHeader.checklistVersion,
            checklistFootnote: docHeader.checklistFootnote,
            checklistColumn: docHeader.checklistColumn,
          }}
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-neutral-500">Procedure checklist</h2>
        <VisitChecklist
          visitId={visit.id}
          column={docHeader.checklistColumn}
          items={checklist.map((item) => ({ ...item, performedAt: toDateTimeInput(item.performedAt) }))}
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-neutral-500">Nursing sheet</h2>
        <div className="rounded-lg border border-neutral-200 p-5 text-sm dark:border-neutral-800">
          {docHeader.nursingSheet ? (
            <>
              <p className="text-neutral-600 dark:text-neutral-400">
                The standard nursing record for a {visit.visitType} visit —{" "}
                {docHeader.nursingSheet.sections.length} section
                {docHeader.nursingSheet.sections.length === 1 ? "" : "s"},{" "}
                {docHeader.nursingSheet.sections.reduce((n, s) => n + s.rows.length, 0)} rows. Downloads with this
                visit&apos;s number, date, subject and initials filled in
                {visit.kits.length > 0 ? ", plus its kits" : ""}; the readings are handwritten.
              </p>
              <a
                href={`/api/visits/${visit.id}/nursing-sheet-docx`}
                className="mt-3 inline-block font-medium hover:underline"
              >
                Download nursing sheet (.docx)
              </a>
            </>
          ) : (
            <p className="text-neutral-500">
              This visit type has no nursing sheet yet.{" "}
              {visit.templateId ? (
                <Link
                  href={`/dashboard/studies/${visit.studyId}/templates/${visit.templateId}/nursing-sheet`}
                  className="underline"
                >
                  Set one up →
                </Link>
              ) : (
                "Nursing sheets belong to a protocol visit type, and this is a custom visit."
              )}
            </p>
          )}
          {docHeader.nursingSheet && visit.templateId && (
            <Link
              href={`/dashboard/studies/${visit.studyId}/templates/${visit.templateId}/nursing-sheet`}
              className="ml-4 text-xs text-neutral-500 hover:underline"
            >
              Edit the sheet
            </Link>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-neutral-500">Notes</h2>
        <VisitNotes visitId={visit.id} notes={visit.notes ?? ""} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-neutral-500">Kits for this visit</h2>
        <VisitKits
          visitId={visit.id}
          visitOccurred={visit.actualDate !== null}
          kits={visit.kits.map((k) => ({
            id: k.id,
            name: k.name,
            expiryLabel: formatDate(k.expiryDate),
            used: k.usedAt !== null,
          }))}
          availableKits={availableKits.map((k) => ({
            id: k.id,
            label: `${k.name} · expires ${formatDate(k.expiryDate)}`,
          }))}
        />
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
                      {doc.fileUrl ? (
                        <a
                          href={doc.fileUrl.startsWith("http") ? doc.fileUrl : `/api/documents/${doc.id}/file`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {doc.title}
                        </a>
                      ) : (
                        <>
                          {doc.title} <span className="ml-1 text-xs text-neutral-400">(no file attached)</span>
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{humanizeEnum(doc.type)}</td>
                    <td className="whitespace-nowrap px-4 py-2">{doc.version}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <DocumentStatusControl documentId={doc.id} status={getDocumentDisplayStatus(doc)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {visit.status !== "COMPLETED" && (
        <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <DeleteVisitButton visitId={visit.id} label={`${visit.visitType} for ${visit.subject.subjectCode}`} />
        </div>
      )}
    </div>
  );
}
