import { notFound } from "next/navigation";
import Link from "next/link";
import { getTemplateWithChecklist } from "@/lib/queries";
import { parseNursingSheet } from "@/lib/nursing-sheet";
import { NursingSheetEditor } from "./nursing-sheet-editor";
import { getT } from "@/lib/i18n/server";

export default async function NursingSheetPage({
  params,
}: {
  params: Promise<{ id: string; templateId: string }>;
}) {
  const t = await getT();
  const { id: studyId, templateId } = await params;
  const template = await getTemplateWithChecklist(templateId);
  if (!template || template.studyId !== studyId) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={`/dashboard/studies/${studyId}/templates`} className="text-sm text-neutral-500 hover:underline">
          {t("← {0} visit schedule", [template.study.protocolId])}</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("{0} nursing sheet", [template.name])}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t("The nursing record for every {0} visit: which vital signs and collections are recorded, and in which columns. Every visit can already download the standard sheet; change it here to give {0} visits their own. Each download has the visit, date, subject, kits and notes filled in; the initials and the readings themselves are handwritten.", [template.name])}</p>
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
