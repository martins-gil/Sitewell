"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type CalendarVisit = {
  id: string;
  subjectId: string;
  subjectCode: string;
  protocolId: string;
  visitType: string;
  targetDate: string; // ISO date string
  status: string;
};

const STATUS_DOT: Record<string, string> = {
  SCHEDULED: "bg-blue-500",
  COMPLETED: "bg-green-500",
  MISSED: "bg-red-500",
  RESCHEDULED: "bg-amber-500",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function VisitsCalendar({ visits }: { visits: CalendarVisit[] }) {
  const router = useRouter();
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const visitsByDay = useMemo(() => {
    const map = new Map<string, CalendarVisit[]>();
    for (const v of visits) {
      const key = toDateKey(new Date(v.targetDate));
      const existing = map.get(key);
      if (existing) existing.push(v);
      else map.set(key, [v]);
    }
    return map;
  }, [visits]);

  const cells = useMemo(() => {
    const firstOfMonth = monthCursor;
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - firstOfMonth.getDay());

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      return {
        date,
        inCurrentMonth: date.getMonth() === firstOfMonth.getMonth(),
        isToday: toDateKey(date) === toDateKey(new Date()),
        visits: visitsByDay.get(toDateKey(date)) ?? [],
      };
    });
  }, [monthCursor, visitsByDay]);

  const monthLabel = monthCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h2 className="text-sm font-medium">{monthLabel}</h2>
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
            className="rounded-md border border-neutral-300 px-2 py-1 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            ← Prev
          </button>
          <button
            onClick={() => {
              const now = new Date();
              setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
            className="rounded-md border border-neutral-300 px-2 py-1 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Today
          </button>
          <button
            onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
            className="rounded-md border border-neutral-300 px-2 py-1 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-neutral-200 text-center text-xs font-medium text-neutral-500 dark:border-neutral-800">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map(({ date, inCurrentMonth, isToday, visits: dayVisits }) => (
          <div
            key={date.toISOString()}
            className={`min-h-[6.5rem] border-b border-r border-neutral-100 p-1.5 dark:border-neutral-900 ${
              inCurrentMonth ? "" : "bg-neutral-50 dark:bg-neutral-950"
            }`}
          >
            <div
              className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                isToday
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : inCurrentMonth
                    ? "text-neutral-700 dark:text-neutral-300"
                    : "text-neutral-400"
              }`}
            >
              {date.getDate()}
            </div>
            <div className="space-y-0.5">
              {dayVisits.slice(0, 3).map((v) => (
                <button
                  key={v.id}
                  onClick={() => router.push(`/dashboard/subjects/${v.subjectId}`)}
                  title={`${v.protocolId} ${v.subjectCode} — ${v.visitType} (${v.status})`}
                  className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[v.status] ?? "bg-neutral-400"}`} />
                  <span className="truncate font-mono">{v.subjectCode}</span>
                </button>
              ))}
              {dayVisits.length > 3 && (
                <div className="px-1 text-[11px] text-neutral-400">+{dayVisits.length - 3} more</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
