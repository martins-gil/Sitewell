import { getAllVisits, getStudies, getVisitSchedulingData } from "@/lib/queries";
import { SendRemindersButton } from "./send-reminders-button";
import { VisitsView } from "./visits-view";
import type { CalendarVisit } from "./visits-calendar";
import { getT } from "@/lib/i18n/server";
import { resolveStudyColors } from "@/lib/study-colors";

export default async function VisitsPage() {
  const t = await getT();
  const [visits, studies, scheduling] = await Promise.all([
    getAllVisits(),
    getStudies(),
    getVisitSchedulingData(),
  ]);

  const calendarVisits: CalendarVisit[] = visits.map((v) => ({
    id: v.id,
    subjectId: v.subjectId,
    subjectCode: v.subject.subjectCode,
    studyId: v.studyId,
    protocolId: v.study.protocolId,
    visitType: v.visitType,
    targetDate: v.targetDate.toISOString(),
    status: v.status,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Visits Schedule")}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {t("{0} visit across all studies.|{0} visits across all studies.", [visits.length])}
          </p>
        </div>
        <SendRemindersButton />
      </div>

      <VisitsView
        tableVisits={visits}
        calendarVisits={calendarVisits}
        studyColors={resolveStudyColors(studies)}
        studies={studies}
        schedulingSubjects={scheduling.subjects}
        schedulingTemplates={scheduling.templates}
      />
    </div>
  );
}
