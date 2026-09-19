import { notFound } from "next/navigation";
import Link from "next/link";
import { getTemplateWithChecklist } from "@/lib/queries";
import { parseNursingSheet } from "@/lib/nursing-sheet";
import { NursingSheetEditor } from "./nursing-sheet-editor";

export default async function NursingSheetPage({
  params,
}: {
  params: Promise<{ id: string; templateId: string }>;
}) {
  const { id: studyId, templateId } = await params;
  const template = await getTemplateWithChecklist(templateId);
  if (!template || template.studyId !== studyId) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={`/dashboard/studies/${studyId}/templates`} className="text-sm text-neutral-500 hover:underline">
          ← {template.study.protocolId} visit schedule
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{template.name} nursing sheet</h1>
        <p className="mt-1 text-sm text-neutral-500">
          The standard nursing record for every {template.name} visit: which vital signs and collections are
          recorded, and in which columns. Each visit downloads it as a .docx with its own visit, date, subject
          initials and kits filled in; the readings themselves are handwritten.
        </p>
      </div>

      <NursingSheetEditor
        studyId={studyId}
        templateId={templateId}
        visitName={template.name}
        initial={parseNursingSheet(template.nursingSheet)}
      />
    </div>
  );
}
