"use client";

import type { SubjectStatus } from "@prisma/client";
import { useState, useTransition } from "react";
import { updateSubjectStatus } from "./actions";

const STATUSES: SubjectStatus[] = [
  "IDENTIFIED",
  "PRE_SCREENED",
  "SCREENED",
  "CONSENTED",
  "ENROLLED",
  "SCREEN_FAILED",
  "WITHDRAWN",
];

export function StatusControl({
  subjectId,
  currentStatus,
}: {
  subjectId: string;
  currentStatus: SubjectStatus;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [pending, startTransition] = useTransition();

  function handleChange(next: SubjectStatus) {
    setStatus(next);
    startTransition(async () => {
      await updateSubjectStatus(subjectId, next);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value as SubjectStatus)}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      {pending && <span className="text-xs text-neutral-500">Saving…</span>}
    </div>
  );
}
