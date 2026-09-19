"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/badge";
import { updateVisit } from "../actions";

export type VisitDetailsValues = {
  visitType: string;
  isCustom: boolean;
  status: string;
  targetLabel: string;
  windowLabel: string;
  actualLabel: string;
  targetInput: string;
  actualInput: string;
  windowBeforeDays: number;
  windowAfterDays: number;
};

const STATUSES = ["SCHEDULED", "COMPLETED", "MISSED", "RESCHEDULED"];

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";

/** The visit's dates and status, with an edit form — so a visit can be
 * corrected once it exists, not just rescheduled from the list. */
export function EditVisitForm({ visitId, values }: { visitId: string; values: VisitDetailsValues }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateVisit(visitId, formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  if (!editing) {
    return (
      <div className="rounded-lg border border-neutral-200 p-5 text-sm dark:border-neutral-800">
        <dl className="grid grid-cols-2 gap-y-2">
          <dt className="text-neutral-500">Target date</dt>
          <dd>{values.targetLabel}</dd>
          <dt className="text-neutral-500">Window</dt>
          <dd>{values.windowLabel}</dd>
          <dt className="text-neutral-500">Actual date</dt>
          <dd>{values.actualLabel}</dd>
          <dt className="text-neutral-500">Status</dt>
          <dd>
            <Badge value={values.status} />
          </dd>
        </dl>
        <button type="button" onClick={() => setEditing(true)} className="mt-3 text-xs font-medium hover:underline">
          Edit visit
        </button>
      </div>
    );
  }

  return (
    <form
      action={handleSave}
      className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <div className="grid grid-cols-2 gap-3">
        {values.isCustom ? (
          <div className="col-span-2">
            <label className="block text-xs font-medium">Visit name</label>
            <input name="visitType" required defaultValue={values.visitType} className={inputClass} />
          </div>
        ) : (
          <p className="col-span-2 text-xs text-neutral-500">
            {values.visitType} comes from the study&apos;s visit schedule, so its name stays as is — to change the
            type, remove this visit and add another.
          </p>
        )}
        <div>
          <label className="block text-xs font-medium">Target date</label>
          <input type="date" name="targetDate" required defaultValue={values.targetInput} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium">Status</label>
          <select name="status" defaultValue={values.status} className={inputClass}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium">Window before (days)</label>
          <input type="number" name="windowBeforeDays" min={0} defaultValue={values.windowBeforeDays} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium">Window after (days)</label>
          <input type="number" name="windowAfterDays" min={0} defaultValue={values.windowAfterDays} className={inputClass} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">Actual date (leave blank if it hasn&apos;t happened)</label>
          <input type="date" name="actualDate" defaultValue={values.actualInput} className={inputClass} />
          <p className="mt-1 text-xs text-neutral-500">Entering an actual date marks the visit Completed.</p>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
