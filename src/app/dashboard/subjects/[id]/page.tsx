import { notFound } from "next/navigation";
import Link from "next/link";
import { getSubjectById } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/badge";
import { StatusControl } from "./status-control";
import { IeCriteriaEditor } from "./ie-criteria";
import { EditDisplayName } from "./edit-display-name";
import { VisitScheduler } from "./visit-scheduler";
import { PatientVisitsTable } from "./patient-visits-table";
import { canScheduleVisits, DAY_MS } from "@/lib/visit-scheduling";
import { getT } from "@/lib/i18n/server";

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const subject = await getSubjectById(id);
  if (!subject) notFound();

  const criteria = subject.ieCriteriaSnapshot as { criterion: string; met: boolean | null }[] | null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/subjects" className="text-sm text-neutral-500 hover:underline">
          {t("← Patients")}</Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{subject.subjectCode}</h1>
          <Badge value={subject.status} />
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {subject.study.protocolId} — {subject.study.title}
        </p>
        <div className="mt-1">
          <EditDisplayName subjectId={subject.id} initial={subject.displayName} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="mb-3 text-sm font-medium text-neutral-500">{t("Funnel stage")}</h2>
          <StatusControl subjectId={subject.id} currentStatus={subject.status} />
          {subject.enrolledAt && (
            <p className="mt-3 text-xs text-neutral-500">{t("Enrolled {0}", [formatDate(subject.enrolledAt, t.locale)])}</p>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="mb-3 text-sm font-medium text-neutral-500">{t("I/E criteria")}</h2>
          <IeCriteriaEditor subjectId={subject.id} initialCriteria={criteria ?? []} />
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
          <h2 className="text-sm font-medium text-neutral-500">
            {t("Visits")} {subject.visits.length > 0 && `(${subject.visits.length})`}
          </h2>
        </div>
        <div className="border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
          {canScheduleVisits(subject.status) ? (
            <VisitScheduler
              subject={{
                id: subject.id,
                studyId: subject.studyId,
                subjectCode: subject.subjectCode,
                displayName: subject.displayName,
                status: subject.status,
                scheduledTemplateIds: subject.visits.flatMap((v) => (v.templateId ? [v.templateId] : [])),
              }}
              templates={subject.study.templates}
            />
          ) : (
            <p className="text-xs text-neutral-500">
              {t("Visits can be added once the patient is pre-screened, screened, consented or enrolled.")}</p>
          )}
        </div>
        {subject.visits.length === 0 ? (
          <p className="px-5 py-4 text-sm text-neutral-500">
            {canScheduleVisits(subject.status)
              ? t("No visits yet. Add them above to build this patient's program — or, if none are added, the study's protocol schedule is generated automatically when the patient is marked Enrolled.")
              : t("No visits yet.")}
          </p>
        ) : (
          <PatientVisitsTable
            visits={subject.visits.map((v) => ({
              id: v.id,
              visitType: v.visitType,
              status: v.status,
              targetLabel: formatDate(v.targetDate, t.locale),
              windowLabel: `${formatDate(v.windowStart, t.locale)} – ${formatDate(v.windowEnd, t.locale)}`,
              targetInput: v.targetDate.toISOString().slice(0, 10),
              windowBeforeDays: Math.round((v.targetDate.getTime() - v.windowStart.getTime()) / DAY_MS),
              windowAfterDays: Math.round((v.windowEnd.getTime() - v.targetDate.getTime()) / DAY_MS),
            }))}
          />
        )}
      </div>
    </div>
  );
}
