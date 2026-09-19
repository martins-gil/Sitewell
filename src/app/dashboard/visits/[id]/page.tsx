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
import { VisitSection } from "./visit-section";
import { DocumentStatusControl } from "@/app/dashboard/documents/document-status-control";
import { VisitDocHeader } from "./visit-doc-header";
import { EditVisitForm } from "./edit-visit-form";
import { DeleteVisitButton } from "./delete-visit-button";
import { getT } from "@/lib/i18n/server";
import { getSectionModes } from "@/lib/preferences-server";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  const modes = await getSectionModes();
  const { id } = await params;
  const [visit, checklist, docHeader] = await Promise.all([
    getVisitById(id),
    getVisitChecklist(id),
    getVisitChecklistHeader(id),
  ]);
  if (!visit) notFound();
  const availableKits = await getAssignableKitsForStudy(visit.studyId);
  const nursingSheetUrl = visit.templateId
    ? `/dashboard/studies/${visit.studyId}/templates/${visit.templateId}/nursing-sheet`
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/visits" className="text-sm text-neutral-500 hover:underline">
          {t("← Visits")}
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
          targetLabel: formatDate(visit.targetDate, t.locale),
          windowLabel: `${formatDate(visit.windowStart, t.locale)} – ${formatDate(visit.windowEnd, t.locale)}`,
          actualLabel: formatDate(visit.actualDate, t.locale),
          targetInput: visit.targetDate.toISOString().slice(0, 10),
          actualInput: visit.actualDate ? visit.actualDate.toISOString().slice(0, 10) : "",
          windowBeforeDays: Math.round((visit.targetDate.getTime() - visit.windowStart.getTime()) / DAY_MS),
          windowAfterDays: Math.round((visit.windowEnd.getTime() - visit.targetDate.getTime()) / DAY_MS),
        }}
      />

      <VisitSection mode={modes.details} title={t("Document details (printed on the .docx)")}>
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
            protocolReleaseLabel: formatDate(docHeader.protocolReleaseDate, t.locale),
            protocolReleaseInput: docHeader.protocolReleaseDate
              ? docHeader.protocolReleaseDate.toISOString().slice(0, 10)
              : "",
            checklistVersion: docHeader.checklistVersion,
            checklistFootnote: docHeader.checklistFootnote,
            checklistColumn: docHeader.checklistColumn,
          }}
        />
      </VisitSection>

      <VisitSection mode={modes.checklist} title={t("Procedure checklist")}>
        <VisitChecklist
          visitId={visit.id}
          column={docHeader.checklistColumn}
          items={checklist.map((item) => ({ ...item, performedAt: toDateTimeInput(item.performedAt) }))}
        />
      </VisitSection>

      <VisitSection mode={modes.nursing} title={t("Nursing sheet")}>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
          <p className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
            {docHeader.nursingSheetIsCustom
              ? t("The nursing record set up for {0} visits", [visit.visitType])
              : t("The standard nursing record")}{" "}
            —{" "}
            {t("{0} sections, {1} rows.", [
              docHeader.nursingSheet.sections.length,
              docHeader.nursingSheet.sections.reduce((n, s) => n + s.rows.length, 0),
            ])}{" "}
            {visit.kits.length > 0
              ? t("It downloads with this visit's number, date, subject and initials filled in, plus its kits and notes; the readings are handwritten.")
              : t("It downloads with this visit's number, date, subject and initials filled in, plus its notes; the readings are handwritten.")}{" "}
            {nursingSheetUrl ? (
              <Link href={nursingSheetUrl} className="underline">
                {docHeader.nursingSheetIsCustom
                  ? t("Edit the sheet →")
                  : t("Customise it for {0} visits →", [visit.visitType])}
              </Link>
            ) : (
              t("(Custom visits always use the standard sheet.)")
            )}
          </p>
          <a
            href={`/api/visits/${visit.id}/nursing-sheet-docx`}
            className="block border-t border-neutral-200 px-4 py-2.5 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            {t("Download nursing sheet (.docx)")}
          </a>
        </div>
      </VisitSection>

      <VisitSection mode={modes.notes} title={t("Notes")}>
        <VisitNotes visitId={visit.id} notes={visit.notes ?? ""} />
      </VisitSection>

      <VisitSection mode={modes.kits} title={t("Kits for this visit")}>
        <VisitKits
          visitId={visit.id}
          visitOccurred={visit.actualDate !== null}
          kits={visit.kits.map((k) => ({
            id: k.id,
            name: k.name,
            expiryLabel: formatDate(k.expiryDate, t.locale),
            used: k.usedAt !== null,
          }))}
          availableKits={availableKits.map((k) => ({
            id: k.id,
            label: t("{0} · expires {1}", [k.name, formatDate(k.expiryDate, t.locale)]),
          }))}
        />
      </VisitSection>

      <VisitSection
        mode={modes.documents}
        title={`${t("Documents for this visit")}${visit.documents.length > 0 ? ` (${visit.documents.length})` : ""}`}
      >
        <VisitUploadForm studyId={visit.studyId} visitId={visit.id} />

        {visit.documents.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">{t("No documents uploaded for this visit yet.")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Title")}</th>
                  <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Type")}</th>
                  <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Version")}</th>
                  <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Status")}</th>
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
                          {doc.title} <span className="ml-1 text-xs text-neutral-400">{t("(no file attached)")}</span>
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{t(humanizeEnum(doc.type))}</td>
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
      </VisitSection>

      {visit.status !== "COMPLETED" && (
        <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <DeleteVisitButton
            visitId={visit.id}
            label={t("{0} for {1}", [visit.visitType, visit.subject.subjectCode])}
          />
        </div>
      )}
    </div>
  );
}
