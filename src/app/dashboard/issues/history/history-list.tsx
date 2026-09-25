"use client";

import { useState, useTransition } from "react";
import { reopenPendingIssue } from "../actions";
import { studyColor } from "@/lib/study-colors";
import { useT } from "@/lib/i18n/client";

export type ResolvedIssueRow = {
  id: string;
  text: string;
  protocolId: string | null;
  colorId: string | null;
  resolvedDateLabel: string;
};

function HistoryRow({ issue }: { issue: ResolvedIssueRow }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [reopened, setReopened] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reopen() {
    setError(null);
    startTransition(async () => {
      try {
        await reopenPendingIssue(issue.id);
        setReopened(true);
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  return (
    <li className={`flex items-start gap-3 px-4 py-2.5 text-sm ${reopened ? "opacity-40" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap">{issue.text}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
          {issue.protocolId && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: studyColor(issue.colorId ?? "blue") }} />
              {issue.protocolId}
            </span>
          )}
          <span>{t("Resolved {0}", [issue.resolvedDateLabel])}</span>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      {!reopened && (
        <button
          type="button"
          disabled={pending}
          onClick={reopen}
          className="shrink-0 text-xs text-neutral-500 hover:underline disabled:opacity-60"
        >
          {t("Reopen")}
        </button>
      )}
    </li>
  );
}

export type WeekGroup = { label: string; issues: ResolvedIssueRow[] };
export type MonthGroup = { label: string; weeks: WeekGroup[] };

export function IssueHistory({ months }: { months: MonthGroup[] }) {
  const t = useT();
  if (months.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 px-4 py-6 text-center text-sm text-neutral-400 dark:border-neutral-800">
        {t("Nothing resolved yet.")}
      </p>
    );
  }
  return (
    <div className="space-y-6">
      {months.map((month) => (
        <section key={month.label} className="space-y-3">
          <h2 className="text-sm font-semibold">{month.label}</h2>
          {month.weeks.map((week) => (
            <div key={week.label}>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">{week.label}</h3>
              <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                {week.issues.map((issue) => (
                  <HistoryRow key={issue.id} issue={issue} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
