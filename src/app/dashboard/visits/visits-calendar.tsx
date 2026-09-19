"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type CalendarVisit = {
  id: string;
  subjectId: string;
  subjectCode: string;
  studyId: string;
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
const MONTH_NAMES = Array.from({ length: 12 }, (_, m) =>
  new Date(2000, m, 1).toLocaleDateString("en-US", { month: "long" }),
);

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthGridCells(monthStart: Date, visitsByDay: Map<string, CalendarVisit[]>) {
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    return {
      date,
      inCurrentMonth: date.getMonth() === monthStart.getMonth(),
      isToday: toDateKey(date) === toDateKey(new Date()),
      visits: visitsByDay.get(toDateKey(date)) ?? [],
    };
  });
}

export function VisitsCalendar({
  visits,
  onAddOnDay,
}: {
  visits: CalendarVisit[];
  onAddOnDay?: (dateKey: string) => void;
}) {
  const router = useRouter();
  const [granularity, setGranularity] = useState<"month" | "year">("month");
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

  const cells = useMemo(() => monthGridCells(monthCursor, visitsByDay), [monthCursor, visitsByDay]);
  const monthLabel = monthCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function goToMonth(year: number, month: number) {
    setMonthCursor(new Date(year, month, 1));
    setGranularity("month");
  }

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-medium">
            {granularity === "month" ? monthLabel : monthCursor.getFullYear()}
          </h2>
          <div className="flex gap-1 text-sm">
            {(["month", "year"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`rounded-md px-2 py-1 capitalize ${
                  granularity === g
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            onClick={() =>
              setMonthCursor(
                granularity === "month"
                  ? new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1)
                  : new Date(monthCursor.getFullYear() - 1, monthCursor.getMonth(), 1),
              )
            }
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
            onClick={() =>
              setMonthCursor(
                granularity === "month"
                  ? new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1)
                  : new Date(monthCursor.getFullYear() + 1, monthCursor.getMonth(), 1),
              )
            }
            className="rounded-md border border-neutral-300 px-2 py-1 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Next →
          </button>
        </div>
      </div>

      {granularity === "month" ? (
        <>
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
                <div className="mb-1 flex items-center justify-between">
                  <div
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      isToday
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                        : inCurrentMonth
                          ? "text-neutral-700 dark:text-neutral-300"
                          : "text-neutral-400"
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  {onAddOnDay && (
                    <button
                      type="button"
                      onClick={() => onAddOnDay(toDateKey(date))}
                      title={`Add a visit on ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      aria-label={`Add a visit on ${toDateKey(date)}`}
                      className="flex h-5 w-5 items-center justify-center rounded text-sm leading-none text-neutral-300 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                    >
                      +
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayVisits.slice(0, 3).map((v) => (
                    <button
                      key={v.id}
                      onClick={() => router.push(`/dashboard/visits/${v.id}`)}
                      title={`${v.protocolId} ${v.subjectCode} — ${v.visitType} (${v.status})`}
                      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[v.status] ?? "bg-neutral-400"}`} />
                      <span className="truncate">
                        <span className="font-mono">{v.subjectCode}</span>{" "}
                        <span className="text-neutral-500">{v.visitType}</span>
                      </span>
                    </button>
                  ))}
                  {dayVisits.length > 3 && (
                    <div className="px-1 text-[11px] text-neutral-400">+{dayVisits.length - 3} more</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {MONTH_NAMES.map((name, monthIndex) => {
            const monthStart = new Date(monthCursor.getFullYear(), monthIndex, 1);
            const monthCells = monthGridCells(monthStart, visitsByDay).filter((c) => c.inCurrentMonth);
            const monthVisitCount = monthCells.reduce((sum, c) => sum + c.visits.length, 0);
            return (
              <div key={name} className="rounded-md border border-neutral-200 p-2 dark:border-neutral-800">
                <button
                  onClick={() => goToMonth(monthCursor.getFullYear(), monthIndex)}
                  className="mb-1.5 flex w-full items-center justify-between text-xs font-medium hover:underline"
                >
                  <span>{name}</span>
                  {monthVisitCount > 0 && <span className="text-neutral-400">{monthVisitCount}</span>}
                </button>
                <div className="grid grid-cols-7 gap-px text-center">
                  {monthCells.map((c) => (
                    <button
                      key={c.date.toISOString()}
                      disabled={c.visits.length === 0}
                      onClick={() => goToMonth(monthCursor.getFullYear(), monthIndex)}
                      title={c.visits.length > 0 ? `${c.visits.length} visit(s)` : undefined}
                      className={`flex h-5 w-5 items-center justify-center rounded-sm text-[9px] ${
                        c.visits.length > 0
                          ? "bg-blue-500 font-medium text-white"
                          : c.isToday
                            ? "border border-neutral-400 text-neutral-500"
                            : "text-neutral-300 dark:text-neutral-700"
                      }`}
                    >
                      {c.date.getDate()}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
