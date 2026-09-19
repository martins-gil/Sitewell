"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { humanizeEnum } from "@/lib/format";

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

type Granularity = "month" | "year" | "day";

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

const navButton =
  "rounded-md border border-neutral-300 px-2 py-1 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";

export function VisitsCalendar({
  visits,
  onAddOnDay,
}: {
  visits: CalendarVisit[];
  onAddOnDay?: (dateKey: string) => void;
}) {
  const router = useRouter();
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dayCursor, setDayCursor] = useState(() => new Date());

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
  const dayLabel = dayCursor.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const dayKey = toDateKey(dayCursor);
  const dayVisits = useMemo(
    () =>
      [...(visitsByDay.get(dayKey) ?? [])].sort(
        (a, b) => a.protocolId.localeCompare(b.protocolId) || a.subjectCode.localeCompare(b.subjectCode),
      ),
    [visitsByDay, dayKey],
  );

  function goToMonth(year: number, month: number) {
    setMonthCursor(new Date(year, month, 1));
    setGranularity("month");
  }

  function goToDay(date: Date) {
    setDayCursor(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
    setMonthCursor(new Date(date.getFullYear(), date.getMonth(), 1));
    setGranularity("day");
  }

  // Switching to Day from the toggle: today if it's in the month being
  // looked at, otherwise that month's first day.
  function openDayView() {
    const now = new Date();
    const inVisibleMonth = now.getFullYear() === monthCursor.getFullYear() && now.getMonth() === monthCursor.getMonth();
    goToDay(inVisibleMonth ? now : monthCursor);
  }

  function step(direction: -1 | 1) {
    if (granularity === "day") {
      goToDay(new Date(dayCursor.getFullYear(), dayCursor.getMonth(), dayCursor.getDate() + direction));
    } else if (granularity === "month") {
      setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + direction, 1));
    } else {
      setMonthCursor(new Date(monthCursor.getFullYear() + direction, monthCursor.getMonth(), 1));
    }
  }

  function goToToday() {
    const now = new Date();
    if (granularity === "day") goToDay(now);
    else setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-medium">
            {granularity === "day" ? dayLabel : granularity === "month" ? monthLabel : monthCursor.getFullYear()}
          </h2>
          <div className="flex gap-1 text-sm">
            {(["day", "month", "year"] as const).map((g) => (
              <button
                key={g}
                onClick={() => (g === "day" ? openDayView() : setGranularity(g))}
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
          <button onClick={() => step(-1)} className={navButton}>
            ← Prev
          </button>
          <button onClick={goToToday} className={navButton}>
            Today
          </button>
          <button onClick={() => step(1)} className={navButton}>
            Next →
          </button>
        </div>
      </div>

      {granularity === "day" ? (
        <div className="p-4">
          {dayVisits.length === 0 ? (
            <p className="text-sm text-neutral-500">No visits on this day.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {dayVisits.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[v.status] ?? "bg-neutral-400"}`} />
                    <Link href={`/dashboard/visits/${v.id}`} className="font-medium hover:underline">
                      {v.visitType}
                    </Link>
                    <Link href={`/dashboard/subjects/${v.subjectId}`} className="font-mono text-xs hover:underline">
                      {v.subjectCode}
                    </Link>
                    <span className="text-xs text-neutral-500">{v.protocolId}</span>
                  </div>
                  <span className="text-xs text-neutral-500">{humanizeEnum(v.status)}</span>
                </li>
              ))}
            </ul>
          )}
          {onAddOnDay && (
            <button
              type="button"
              onClick={() => onAddOnDay(dayKey)}
              className="mt-3 text-sm text-neutral-600 hover:underline dark:text-neutral-400"
            >
              + Add a visit on this day
            </button>
          )}
        </div>
      ) : granularity === "month" ? (
        <>
          <div className="grid grid-cols-7 border-b border-neutral-200 text-center text-xs font-medium text-neutral-500 dark:border-neutral-800">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map(({ date, inCurrentMonth, isToday, visits: dayCellVisits }) => (
              <div
                key={date.toISOString()}
                className={`min-h-[6.5rem] border-b border-r border-neutral-100 p-1.5 dark:border-neutral-900 ${
                  inCurrentMonth ? "" : "bg-neutral-50 dark:bg-neutral-950"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => goToDay(date)}
                    title="See this day's visits"
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs hover:underline ${
                      isToday
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                        : inCurrentMonth
                          ? "text-neutral-700 dark:text-neutral-300"
                          : "text-neutral-400"
                    }`}
                  >
                    {date.getDate()}
                  </button>
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
                  {dayCellVisits.slice(0, 3).map((v) => (
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
                  {dayCellVisits.length > 3 && (
                    <button
                      type="button"
                      onClick={() => goToDay(date)}
                      className="px-1 text-[11px] text-neutral-400 hover:underline"
                    >
                      +{dayCellVisits.length - 3} more
                    </button>
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
                      onClick={() => goToDay(c.date)}
                      title={c.visits.length > 0 ? `${c.visits.length} visit(s) — open this day` : undefined}
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
