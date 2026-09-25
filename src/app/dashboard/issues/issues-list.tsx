"use client";

import { useState, useTransition } from "react";
import { resolvePendingIssue, deletePendingIssue } from "./actions";
import { studyColor } from "@/lib/study-colors";
import { useT } from "@/lib/i18n/client";

export type IssueRow = {
  id: string;
  text: string;
  protocolId: string | null;
  colorId: string | null;
  dateLabel: string;
};

function IssueRowItem({ issue }: { issue: IssueRow }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ticking the box resolves it right away; the little delay before it visually
  // disappears is just so the checkmark is seen (revalidatePath removes the row).
  function resolve() {
    setChecked(true);
    setError(null);
    startTransition(async () => {
      try {
        await resolvePendingIssue(issue.id);
      } catch {
        setChecked(false);
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  function remove() {
    if (!window.confirm(t("Delete this issue? This can't be undone.")))
      return;
    setError(null);
    startTransition(async () => {
      try {
        await deletePendingIssue(issue.id);
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  return (
    <li className={`flex items-start gap-3 px-4 py-3 transition-opacity ${checked ? "opacity-40" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        onChange={resolve}
        aria-label={t("Mark resolved")}
        className="mt-1 h-4 w-4 shrink-0 rounded border-neutral-300 dark:border-neutral-600"
      />
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap text-sm">{issue.text}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
          {issue.protocolId && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: studyColor(issue.colorId ?? "blue") }} />
              {issue.protocolId}
            </span>
          )}
          <span>{issue.dateLabel}</span>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={remove}
        className="shrink-0 text-xs text-neutral-400 hover:text-red-700 hover:underline disabled:opacity-60 dark:hover:text-red-400"
      >
        {t("Delete")}
      </button>
    </li>
  );
}

export function IssuesList({ issues }: { issues: IssueRow[] }) {
  const t = useT();
  if (issues.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 px-4 py-6 text-center text-sm text-neutral-400 dark:border-neutral-800">
        {t("No pending issues — everything is sorted out.")}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {issues.map((issue) => (
        <IssueRowItem key={issue.id} issue={issue} />
      ))}
    </ul>
  );
}
