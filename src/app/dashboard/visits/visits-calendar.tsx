"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { humanizeEnum } from "@/lib/format";
import { patientTone, studyColor } from "@/lib/study-colors";
import { compareStartTime } from "@/lib/visit-time";
import type { CalendarMonitoring } from "@/lib/monitoring";
import { useT } from "@/lib/i18n/client";

export type CalendarVisit = {
  id: string;
  subjectId: string;
  subjectCode: string;
  studyId: string;
  protocolId: string;
  visitType: string;
  targetDate: string; // ISO date string
  startTime: string | null; // "HH:mm"
  windowStart: string; // ISO date string
  windowEnd: string; // ISO date string
  kits: string[];
  status: string;
};

// What a calendar day holds: a patient's visit, or a monitoring visit.
type CalendarEntry =
  | ({ kind: "visit" } & CalendarVisit)
  | ({ kind: "monitoring" } & CalendarMonitoring);

type Mode = "day" | "week";

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  MISSED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  RESCHEDULED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

// Dates are handled as local calendar days (the visit dates are noon UTC, so the day is the
// same in every time zone that matters here).
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** The Monday of the week a date is in — weeks run Monday to Sunday. */
function startOfWeek(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}

function monthGrid(monthStart: Date): Date[] {
  const first = startOfWeek(monthStart);
  const lead = (monthStart.getDay() + 6) % 7;
  const days = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const rows = Math.ceil((lead + days) / 7);
  return Array.from({ length: rows * 7 }, (_, i) => addDays(first, i));
}

function sortEntries(list: CalendarEntry[]): CalendarEntry[] {
  return [...list].sort(
    (a, b) =>
      compareStartTime(a.startTime, b.startTime) ||
      (a.kind === b.kind ? 0 : a.kind === "monitoring" ? -1 : 1) ||
      a.protocolId.localeCompare(b.protocolId) ||
      (a.kind === "visit" && b.kind === "visit" ? a.subjectCode.localeCompare(b.subjectCode) : 0),
  );
}

const iconButton =
  "flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800";

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d={dir === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

function EntryCard({ entry, colorId, dateLocale }: { entry: CalendarEntry; colorId: string; dateLocale: string }) {
  const t = useT();
  const color = entry.kind === "visit" ? patientTone(colorId, entry.subjectCode) : studyColor(colorId);
  const time = entry.startTime;
  return (
    <div className="flex items-stretch gap-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
      <span
        aria-hidden
        className="w-1.5 shrink-0 rounded-full"
        style={entry.kind === "visit" ? { backgroundColor: color } : { backgroundColor: color, opacity: 0.55 }}
      />
      <div className="w-14 shrink-0 pt-0.5">
        {time ? (
          <span className="inline-block rounded-full bg-white px-2 py-0.5 text-xs font-medium dark:bg-neutral-800">{time}</span>
        ) : (
          <span className="text-xs text-neutral-400">{t("All day")}</span>
        )}
      </div>
      {/* Two columns side by side: what the visit is (and its kits) | who, which study, when. */}
      <div className="grid min-w-0 flex-1 gap-x-6 gap-y-1.5 md:grid-cols-2">
        {entry.kind === "visit" ? (
          <>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link href={`/dashboard/visits/${entry.id}`} className="font-medium hover:underline">
                  {entry.visitType}
                </Link>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[entry.status] ?? "bg-neutral-100 text-neutral-700"}`}>
                  {t(humanizeEnum(entry.status))}
                </span>
              </div>
              {entry.kits.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {entry.kits.map((k, i) => (
                    <span key={i} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-0.5 text-xs text-neutral-500">
              <div className="flex flex-wrap items-center gap-x-3">
                <Link href={`/dashboard/subjects/${entry.subjectId}`} className="text-neutral-700 hover:underline dark:text-neutral-300">
                  {entry.subjectCode}
                </Link>
                <span>{entry.protocolId}</span>
              </div>
              <div>
                {t("Window")}:{" "}
                {new Date(entry.windowStart).toLocaleDateString(dateLocale, { month: "short", day: "numeric", timeZone: "UTC" })} –{" "}
                {new Date(entry.windowEnd).toLocaleDateString(dateLocale, { month: "short", day: "numeric", timeZone: "UTC" })}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link href={`/dashboard/monitoring/${entry.id}`} className="font-medium hover:underline">
                {t("Monitoring visit")}
              </Link>
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                {t("Monitoring")}
              </span>
            </div>
            <div className="min-w-0 space-y-0.5 text-xs text-neutral-500">
              <div className="flex flex-wrap items-center gap-x-3">
                <span className="text-neutral-700 dark:text-neutral-300">{entry.protocolId}</span>
                {entry.room && <span>{entry.room}</span>}
              </div>
              {entry.pointCount > 0 && <div>{t("{0}/{1} points checked", [entry.verifiedCount, entry.pointCount])}</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function VisitsCalendar({
  visits,
  monitoring = [],
  studyColors,
  studies,
  onAddOnDay,
  onAddMonitoringOnDay,
}: {
  visits: CalendarVisit[];
  monitoring?: CalendarMonitoring[];
  // Each study's colour (see src/lib/study-colors.ts) and the studies to list in the legend.
  studyColors: Record<string, string>;
  studies: { id: string; protocolId: string }[];
  onAddOnDay?: (dateKey: string) => void;
  onAddMonitoringOnDay?: (dateKey: string) => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("week");
  const [selected, setSelected] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    const entries: CalendarEntry[] = [
      ...visits.map((v): CalendarEntry => ({ kind: "visit", ...v })),
      ...monitoring.map((m): CalendarEntry => ({ kind: "monitoring", ...m })),
    ];
    for (const e of entries) {
      const key = toDateKey(new Date(e.targetDate));
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    for (const [key, list] of map) map.set(key, sortEntries(list));
    return map;
  }, [visits, monitoring]);

  // Day and month names come from the browser's own locale data for the chosen language.
  const dateLocale = t.locale === "en" ? "en-US" : t.locale;
  const fmt = (d: Date, options: Intl.DateTimeFormatOptions) => d.toLocaleDateString(dateLocale, options);
  const todayKey = toDateKey(new Date());
  const selectedKey = toDateKey(selected);

  const weekStart = startOfWeek(selected);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const shownDays = mode === "day" ? [selected] : weekDays;
  const shownEntries = shownDays.flatMap((d) => entriesByDay.get(toDateKey(d)) ?? []);
  const visitCount = shownEntries.filter((e) => e.kind === "visit").length;
  const monitoringCount = shownEntries.length - visitCount;

  const weekdayNames = Array.from({ length: 7 }, (_, i) => fmt(addDays(weekStart, i), { weekday: "short" }));
  const cells = monthGrid(monthCursor);

  const colorOf = (e: CalendarEntry) => studyColors[e.studyId] ?? "blue";

  function select(date: Date) {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    setSelected(day);
    setMonthCursor(new Date(day.getFullYear(), day.getMonth(), 1));
  }

  function step(direction: -1 | 1) {
    select(addDays(selected, direction * (mode === "day" ? 1 : 7)));
  }

  const title =
    mode === "day"
      ? fmt(selected, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : `${fmt(weekDays[0], { month: "short", day: "numeric" })} – ${fmt(weekDays[6], { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
      {/* The details of the selected day or week: above the month on a narrow screen, beside it on a wide one. */}
      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              {t("{0} visit|{0} visits", [visitCount])}
              {monitoringCount > 0 && <> · {t("{0} monitoring visit|{0} monitoring visits", [monitoringCount])}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" className="flex rounded-full bg-neutral-100 p-1 text-sm dark:bg-neutral-800">
              {(["day", "week"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-full px-4 py-1 ${
                    mode === m
                      ? "bg-neutral-900 font-medium text-white shadow-sm dark:bg-white dark:text-neutral-900"
                      : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                  }`}
                >
                  {m === "day" ? t("Day") : t("Week")}
                </button>
              ))}
            </div>
            <button onClick={() => step(-1)} aria-label={t("Previous")} className={iconButton}>
              <Chevron dir="left" />
            </button>
            <button
              onClick={() => select(new Date())}
              className="rounded-full border border-neutral-200 px-4 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              {t("Today")}
            </button>
            <button onClick={() => step(1)} aria-label={t("Next")} className={iconButton}>
              <Chevron dir="right" />
            </button>
            {onAddOnDay && (
              <button
                type="button"
                onClick={() => onAddOnDay(selectedKey)}
                className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-white hover:brightness-110"
              >
                {t("+ Add visit")}
              </button>
            )}
            {onAddMonitoringOnDay && (
              <button
                type="button"
                onClick={() => onAddMonitoringOnDay(selectedKey)}
                className="rounded-full border border-accent px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft"
              >
                {t("+ Monitoring visit")}
              </button>
            )}
          </div>
        </div>

        <div className="mt-5">
          {mode === "day" ? (
            shownEntries.length === 0 ? (
              <p className="rounded-xl bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500 dark:bg-neutral-900">
                {t("No visits on this day.")}
              </p>
            ) : (
              <div className="space-y-2">
                {shownEntries.map((e) => (
                  <EntryCard key={`${e.kind}-${e.id}`} entry={e} colorId={colorOf(e)} dateLocale={dateLocale} />
                ))}
              </div>
            )
          ) : (
            <div className="space-y-4">
              {weekDays.map((d) => {
                const key = toDateKey(d);
                const list = entriesByDay.get(key) ?? [];
                const isToday = key === todayKey;
                return (
                  <div key={key} className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        select(d);
                        setMode("day");
                      }}
                      title={t("See this day's visits")}
                      className={`flex h-16 w-full shrink-0 flex-row items-center justify-center gap-2 rounded-xl text-center sm:w-16 sm:flex-col sm:gap-0 ${
                        isToday ? "bg-accent text-white" : "bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                      }`}
                    >
                      <span className="text-[11px] uppercase tracking-wide opacity-80">{fmt(d, { weekday: "short" })}</span>
                      <span className="text-xl font-semibold leading-none">{d.getDate()}</span>
                    </button>
                    <div className="min-w-0 flex-1 space-y-2">
                      {list.length === 0 ? (
                        <p className="flex h-full min-h-10 items-center text-sm text-neutral-400">{t("No visits")}</p>
                      ) : (
                        list.map((e) => <EntryCard key={`${e.kind}-${e.id}`} entry={e} colorId={colorOf(e)} dateLocale={dateLocale} />)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* The month, to pick a day or a week from. */}
      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800 xl:sticky xl:top-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold capitalize">{fmt(monthCursor, { month: "long", year: "numeric" })}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
              aria-label={t("Previous month")}
              className={iconButton}
            >
              <Chevron dir="left" />
            </button>
            <button
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
              aria-label={t("Next month")}
              className={iconButton}
            >
              <Chevron dir="right" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {weekdayNames.map((name) => (
            <div key={name} className="pb-1 text-center text-xs font-medium uppercase tracking-wide text-neutral-400">
              {name}
            </div>
          ))}
          {cells.map((date) => {
            const key = toDateKey(date);
            const list = entriesByDay.get(key) ?? [];
            const inMonth = date.getMonth() === monthCursor.getMonth();
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            const inSelectedWeek = mode === "week" && toDateKey(startOfWeek(date)) === toDateKey(weekStart);
            return (
              <button
                key={key}
                type="button"
                onClick={() => select(date)}
                aria-pressed={isSelected}
                aria-label={`${fmt(date, { weekday: "long", month: "long", day: "numeric" })}${list.length > 0 ? ` — ${t("{0} visit|{0} visits", [list.length])}` : ""}`}
                className={`relative flex h-12 flex-col items-center justify-between rounded-xl px-1 py-1.5 text-sm sm:h-14 xl:h-12 ${
                  isSelected
                    ? "bg-accent font-semibold text-white shadow-sm"
                    : inSelectedWeek
                      ? "bg-accent-soft hover:brightness-95"
                      : inMonth
                        ? "bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                        : "text-neutral-300 hover:bg-neutral-50 dark:text-neutral-700 dark:hover:bg-neutral-900"
                } ${isToday && !isSelected ? "ring-2 ring-accent" : ""}`}
              >
                <span className={inMonth || isSelected ? "" : "opacity-60"}>{date.getDate()}</span>
                <span className="flex h-2 items-center gap-0.5">
                  {list.slice(0, 4).map((e) => (
                    <span
                      key={`${e.kind}-${e.id}`}
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={
                        e.kind === "visit"
                          ? { backgroundColor: isSelected ? "#ffffff" : patientTone(colorOf(e), e.subjectCode) }
                          : { border: `1.5px solid ${isSelected ? "#ffffff" : studyColor(colorOf(e))}` }
                      }
                    />
                  ))}
                </span>
                {list.length > 0 && (
                  <span
                    aria-hidden
                    className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ring-2 ring-surface ${
                      isSelected ? "bg-white text-accent" : "bg-accent text-white"
                    }`}
                  >
                    {list.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {studies.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-100 pt-3 text-xs dark:border-neutral-800">
            <span className="text-neutral-500">{t("Colour = study, tone = patient")}</span>
            {studies.map((s) => (
              <span key={s.id} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: studyColor(studyColors[s.id] ?? "blue") }}
                />
                {s.protocolId}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-neutral-500">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border-2 border-neutral-400" />
              {t("Monitoring visit")}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
