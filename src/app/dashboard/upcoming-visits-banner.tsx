"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { patientTone } from "@/lib/study-colors";

export type WeekVisit = {
  id: string;
  subjectCode: string;
  visitType: string;
  dayLabel: string;
  colorId: string;
};

const DISMISSED_KEY = "upcoming-visits-banner-dismissed-on";
const DISMISSED_EVENT = "upcoming-visits-banner-dismissed";
const SHOWN_PER_WEEK = 4;

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(DISMISSED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DISMISSED_EVENT, callback);
  };
}

function getDismissedToday() {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === todayKey();
  } catch {
    return false;
  }
}

function WeekLine({ heading, visits }: { heading: string; visits: WeekVisit[] }) {
  const t = useT();
  if (visits.length === 0) return null;
  const shown = visits.slice(0, SHOWN_PER_WEEK);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-semibold">{heading}</span>
      {shown.map((v) => (
        <Link
          key={v.id}
          href={`/dashboard/visits/${v.id}`}
          className="inline-flex items-center gap-1.5 rounded-md bg-white/70 px-2 py-0.5 hover:bg-white dark:bg-blue-900/60 dark:hover:bg-blue-900"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: patientTone(v.colorId, v.subjectCode) }}
          />
          <span className="font-mono text-xs">{v.subjectCode}</span> {v.visitType}
          <span className="opacity-70">· {v.dayLabel}</span>
        </Link>
      ))}
      {visits.length > shown.length && (
        <Link href="/dashboard/visits" className="underline">
          {t("+{0} more", [visits.length - shown.length])}
        </Link>
      )}
    </div>
  );
}

/**
 * Blue bar across the top of the app with the visits coming up this week and
 * next week (when there are any). "Dismiss for today" hides it until tomorrow.
 */
export function UpcomingVisitsBanner({ thisWeek, nextWeek }: { thisWeek: WeekVisit[]; nextWeek: WeekVisit[] }) {
  const t = useT();
  const [dismissedHere, setDismissedHere] = useState(false);
  // Storage can be unavailable (private mode): then "not dismissed" — show it.
  const dismissedToday = useSyncExternalStore(subscribe, getDismissedToday, () => false);

  if (thisWeek.length + nextWeek.length === 0 || dismissedToday || dismissedHere) return null;

  function dismiss() {
    setDismissedHere(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, todayKey());
      window.dispatchEvent(new Event(DISMISSED_EVENT));
    } catch {
      // Falls back to dismissedHere, which lasts until the next page load.
    }
  }

  return (
    <div
      role="status"
      className="border-b border-blue-300 bg-blue-100 px-6 py-3 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <WeekLine
            heading={t("This week: {0} visit|This week: {0} visits", [thisWeek.length])}
            visits={thisWeek}
          />
          <WeekLine
            heading={t("Next week: {0} visit|Next week: {0} visits", [nextWeek.length])}
            visits={nextWeek}
          />
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <Link href="/dashboard/visits" className="font-medium underline">
            {t("Open Visits Schedule")}
          </Link>
          <button type="button" onClick={dismiss} className="hover:underline">
            {t("Dismiss for today")}
          </button>
        </div>
      </div>
    </div>
  );
}
