"use client";

import { useMemo, useState } from "react";
import {
  AddVisitForm,
  type SchedulingSubject,
  type SchedulingTemplate,
} from "@/components/add-visit-form";
import { VisitsCalendar, type CalendarVisit } from "./visits-calendar";
import { VisitsTable, type TableVisit } from "./visits-table";
import { useT } from "@/lib/i18n/client";

export function VisitsView({
  tableVisits,
  calendarVisits,
  studies,
  schedulingSubjects,
  schedulingTemplates,
  studyColors,
}: {
  tableVisits: TableVisit[];
  calendarVisits: CalendarVisit[];
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

  const filteredTableVisits = useMemo(
    () => (studyId ? tableVisits.filter((v) => v.studyId === studyId) : tableVisits),
    [tableVisits, studyId],
  );
  const filteredCalendarVisits = useMemo(
    () => (studyId ? calendarVisits.filter((v) => v.studyId === studyId) : calendarVisits),
    [calendarVisits, studyId],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex gap-1">
          {(["calendar", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 capitalize ${
                view === v
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              }`}
            >
              {v === "calendar" ? t("Calendar") : t("List")}
            </button>
          ))}
        </div>
        <select
          value={studyId}
          onChange={(e) => setStudyId(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">{t("All studies")}</option>
          {studies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.protocolId} — {s.title}
            </option>
          ))}
        </select>
        <button
          onClick={() => setAdding({ date: null })}
          className="ml-auto rounded-md bg-neutral-900 px-3 py-1 font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          {t("+ Add visit")}</button>
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

      {view === "calendar" ? (
        <VisitsCalendar
          visits={filteredCalendarVisits}
          studyColors={studyColors}
          studies={studyId ? studies.filter((s) => s.id === studyId) : studies}
          onAddOnDay={(date) => setAdding({ date })}
        />
      ) : (
        <VisitsTable visits={filteredTableVisits} />
      )}
    </div>
  );
}
