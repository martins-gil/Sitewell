"use client";

import { useMemo, useState } from "react";
import {
  AddVisitForm,
  type SchedulingSubject,
  type SchedulingTemplate,
} from "@/components/add-visit-form";
import { VisitsCalendar, type CalendarVisit } from "./visits-calendar";
import { VisitsTable, type TableVisit } from "./visits-table";
import { MonitoringVisitForm, type CopySource } from "../monitoring/add-monitoring-form";
import type { CalendarMonitoring } from "@/lib/monitoring";
import { useT } from "@/lib/i18n/client";
import { studyLabel } from "@/lib/study-label";

export function VisitsView({
  tableVisits,
  calendarVisits,
  monitoringVisits,
  studies,
  schedulingSubjects,
  schedulingTemplates,
  studyColors,
}: {
  tableVisits: TableVisit[];
  calendarVisits: CalendarVisit[];
  monitoringVisits: CalendarMonitoring[];
  studyColors: Record<string, string>;
  studies: { id: string; protocolId: string; title: string }[];
  schedulingSubjects: SchedulingSubject[];
  schedulingTemplates: SchedulingTemplate[];
}) {
  const t = useT();
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [studyId, setStudyId] = useState("");
  // `date` is what the calendar's per-day "+" pre-fills; null date = opened
  // from the button, with the date left blank.
  const [adding, setAdding] = useState<{ date: string | null } | null>(null);
  // The same for "+ Monitoring visit": one of the two forms is open at a time.
  const [addingMonitoring, setAddingMonitoring] = useState<{ date: string | null } | null>(null);

  // Earlier monitoring visits with points, to start a new one's list from.
  const dateLocale = t.locale === "en" ? "en-US" : t.locale;
  const monitoringSources: CopySource[] = useMemo(
    () =>
      monitoringVisits
        .filter((m) => m.pointCount > 0)
        .map((m) => ({
          id: m.id,
          studyId: m.studyId,
          label: `${new Date(m.targetDate).toLocaleDateString(dateLocale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}${m.room ? ` · ${m.room}` : ""}`,
          points: m.pointCount,
        })),
    [monitoringVisits, dateLocale],
  );

  const filteredTableVisits = useMemo(
    () => (studyId ? tableVisits.filter((v) => v.studyId === studyId) : tableVisits),
    [tableVisits, studyId],
  );
  const filteredCalendarVisits = useMemo(
    () => (studyId ? calendarVisits.filter((v) => v.studyId === studyId) : calendarVisits),
    [calendarVisits, studyId],
  );

  const filteredMonitoring = useMemo(
    () => (studyId ? monitoringVisits.filter((v) => v.studyId === studyId) : monitoringVisits),
    [monitoringVisits, studyId],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div role="tablist" className="flex rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
          {(["calendar", "list"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-1.5 ${
                view === v
                  ? "bg-neutral-900 font-medium text-white shadow-sm dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              {v === "calendar" ? t("Calendar") : t("List")}
            </button>
          ))}
        </div>
        <select
          value={studyId}
          onChange={(e) => setStudyId(e.target.value)}
          aria-label={t("Study")}
          className="min-w-0 max-w-full rounded-full border border-neutral-200 px-4 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">{t("All studies")}</option>
          {studies.map((s) => (
            <option key={s.id} value={s.id}>
              {studyLabel(s.protocolId, s.title)}
            </option>
          ))}
        </select>
        {/* In the calendar the panel's own buttons add on the day being looked at. */}
        {view === "list" && (
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              onClick={() => {
                setAddingMonitoring(null);
                setAdding({ date: null });
              }}
              className="rounded-full bg-accent px-4 py-2 font-medium text-white hover:brightness-110"
            >
              {t("+ Add visit")}</button>
            <button
              onClick={() => {
                setAdding(null);
                setAddingMonitoring({ date: null });
              }}
              className="rounded-full border border-accent px-4 py-2 font-medium text-accent hover:bg-accent-soft"
            >
              {t("+ Monitoring visit")}</button>
          </div>
        )}
      </div>

      {adding && (
        <AddVisitForm
          // Remount when the pre-filled day changes so the date input picks it up.
          key={adding.date ?? "blank"}
          studies={studies}
          subjects={schedulingSubjects}
          templates={schedulingTemplates}
          initialStudyId={studyId || undefined}
          initialDate={adding.date ?? undefined}
          onClose={() => setAdding(null)}
        />
      )}

      {addingMonitoring && (
        <MonitoringVisitForm
          key={addingMonitoring.date ?? "blank"}
          studies={studies}
          sources={monitoringSources}
          initialStudyId={studyId || undefined}
          initialDate={addingMonitoring.date ?? undefined}
          onClose={() => setAddingMonitoring(null)}
        />
      )}

      {view === "calendar" ? (
        <VisitsCalendar
          visits={filteredCalendarVisits}
          monitoring={filteredMonitoring}
          studyColors={studyColors}
          studies={studyId ? studies.filter((s) => s.id === studyId) : studies}
          onAddOnDay={(date) => {
            setAddingMonitoring(null);
            setAdding({ date });
          }}
          onAddMonitoringOnDay={(date) => {
            setAdding(null);
            setAddingMonitoring({ date });
          }}
        />
      ) : (
        <VisitsTable visits={filteredTableVisits} />
      )}
    </div>
  );
}
