"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { repeatVisit } from "@/app/dashboard/visits/actions";
import { useT } from "@/lib/i18n/client";

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";

/**
 * "Repeat this visit": makes another visit of the same kind — same checklist,
 * nursing sheet and document details — under a new name and date, for the same
 * patient or another patient of the study. Used on a visit's page and in the
 * patient's visit list.
 */
export function RepeatVisitForm({
  visitId,
  defaultName,
  sourceDate,
  sourceTime = "",
  windowBeforeDays,
  windowAfterDays,
  subjectId,
  patients,
  onClose,
}: {
  visitId: string;
  defaultName: string;
  sourceDate: string; // YYYY-MM-DD
  sourceTime?: string; // "HH:mm" or ""
  windowBeforeDays: number;
  windowAfterDays: number;
  subjectId: string;
  // Patients of the same study the copy can go to (the current one included).
  patients: { id: string; subjectCode: string; displayName: string | null }[];
  onClose: () => void;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ id: string; name: string } | null>(null);

  const problems: Record<string, string> = {
    NAME_REQUIRED: t("Give the repeated visit a name."),
    DATE_REQUIRED: t("Pick a date for the repeated visit."),
    OTHER_STUDY: t("Pick a patient from the same study."),
    NOT_SCHEDULABLE: t("Visits can be added once the patient is pre-screened, screened, consented or enrolled."),
  };

  function handleSubmit(formData: FormData) {
    setError(null);
    setAdded(null);
    startTransition(async () => {
      try {
        const result = await repeatVisit(visitId, formData);
        if (result.ok) setAdded({ id: result.id, name: String(formData.get("visitType") ?? "") });
        else setError(problems[result.problem] ?? t("Something went wrong. Please try again."));
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <p className="text-xs text-neutral-500">
        {t("Makes another visit of the same kind: the same procedures, nursing sheet and document details, with the name and date you give it. Notes, kits and attached documents are not copied.")}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium">{t("Name of the repeated visit")}</label>
          <input name="visitType" required autoFocus defaultValue={defaultName} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Target date")}</label>
          <input type="date" name="targetDate" required defaultValue={sourceDate} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Time (optional)")}</label>
          <input type="time" name="startTime" defaultValue={sourceTime} className={inputClass} />
        </div>
        {patients.length > 1 ? (
          <div>
            <label className="block text-xs font-medium">{t("For patient")}</label>
            <select name="subjectId" defaultValue={subjectId} className={inputClass}>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.subjectCode}
                  {p.displayName ? ` (${p.displayName})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="subjectId" value={subjectId} />
        )}
        <div>
          <label className="block text-xs font-medium">{t("Window before (days)")}</label>
          <input type="number" name="windowBeforeDays" min={0} defaultValue={Math.max(0, windowBeforeDays)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Window after (days)")}</label>
          <input type="number" name="windowAfterDays" min={0} defaultValue={Math.max(0, windowAfterDays)} className={inputClass} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {added && (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("Added {0}.", [added.name])}{" "}
          <Link href={`/dashboard/visits/${added.id}`} className="underline">
            {t("Open visit →")}
          </Link>
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? t("Adding…") : t("Repeat visit")}
        </button>
        <button type="button" onClick={onClose} className="text-xs text-neutral-500 hover:underline">
          {t("Close")}
        </button>
      </div>
    </form>
  );
}
