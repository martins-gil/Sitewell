"use client";

import { useState } from "react";
import { VisitsCalendar, type CalendarVisit } from "./visits-calendar";
import { VisitsTable, type TableVisit } from "./visits-table";

export function VisitsView({
  tableVisits,
  calendarVisits,
}: {
  tableVisits: TableVisit[];
  calendarVisits: CalendarVisit[];
}) {
  const [view, setView] = useState<"calendar" | "list">("calendar");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 text-sm">
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

      {view === "calendar" ? (
        <VisitsCalendar visits={calendarVisits} />
      ) : (
        <VisitsTable visits={tableVisits} />
      )}
    </div>
  );
}
