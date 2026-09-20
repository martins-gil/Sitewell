import { headers } from "next/headers";
import { getAllVisits, getCalendarFeedPath, getStudies, getVisitSchedulingData } from "@/lib/queries";
import { CalendarShare } from "./calendar-share";
import { SendRemindersButton } from "./send-reminders-button";
import { VisitsView } from "./visits-view";
import type { CalendarVisit } from "./visits-calendar";
import { getT } from "@/lib/i18n/server";
import { resolveStudyColors } from "@/lib/study-colors";

export default async function VisitsPage() {
  const t = await getT();
  const [visits, studies, scheduling, feedPath] = await Promise.all([
    getAllVisits(),
    getStudies(),
    getVisitSchedulingData(),
    getCalendarFeedPath(),
  ]);

  // The link has to be absolute for a calendar app; build it from how this
  // page was reached (behind Vercel that's the forwarded host).
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const feedUrl = feedPath && host ? `${protocol}://${host}${feedPath}` : null;

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

      <CalendarShare feedUrl={feedUrl} />

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
