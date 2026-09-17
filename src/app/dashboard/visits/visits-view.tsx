"use client";

import { useMemo, useState } from "react";
import { VisitsCalendar, type CalendarVisit } from "./visits-calendar";
import { VisitsTable, type TableVisit } from "./visits-table";

export function VisitsView({
  tableVisits,
  calendarVisits,
  studies,
}: {
  tableVisits: TableVisit[];
  calendarVisits: CalendarVisit[];
  studies: { id: string; protocolId: string; title: string }[];
}) {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [studyId, setStudyId] = useState("");

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
              {v}
            </button>
          ))}
        </div>
        <select
          value={studyId}
          onChange={(e) => setStudyId(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">All studies</option>
          {studies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.protocolId} — {s.title}
            </option>
          ))}
        </select>
      </div>

      {view === "calendar" ? (
        <VisitsCalendar visits={filteredCalendarVisits} />
      ) : (
        <VisitsTable visits={filteredTableVisits} />
      )}
    </div>
  );
}
