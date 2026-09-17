import { getAllVisits } from "@/lib/queries";
import { SendRemindersButton } from "./send-reminders-button";
import { VisitsView } from "./visits-view";
import type { CalendarVisit } from "./visits-calendar";

export default async function VisitsPage() {
  const visits = await getAllVisits();

  const calendarVisits: CalendarVisit[] = visits.map((v) => ({
    id: v.id,
    subjectId: v.subjectId,
    subjectCode: v.subject.subjectCode,
    protocolId: v.study.protocolId,
    visitType: v.visitType,
    targetDate: v.targetDate.toISOString(),
    status: v.status,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visits</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {visits.length} visit{visits.length === 1 ? "" : "s"} across all studies.
          </p>
        </div>
        <SendRemindersButton />
      </div>

      <VisitsView tableVisits={visits} calendarVisits={calendarVisits} />
    </div>
  );
}
