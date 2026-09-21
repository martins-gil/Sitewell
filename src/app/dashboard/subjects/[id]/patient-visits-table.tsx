"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/badge";
import { RepeatVisitForm } from "@/components/repeat-visit-form";
import { moveVisit } from "@/app/dashboard/visits/actions";
import { useT } from "@/lib/i18n/client";

export type PatientVisit = {
  id: string;
  visitType: string;
  status: string;
  targetLabel: string;
  windowLabel: string;
  targetInput: string; // YYYY-MM-DD
  startTime: string; // "HH:mm" or ""
  windowBeforeDays: number;
  windowAfterDays: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const inputClass =
  "mt-1 rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950";

export type RepeatOptions = {
  subjectId: string;
  patients: { id: string; subjectCode: string }[];
};

function VisitRow({ visit, repeat }: { visit: PatientVisit; repeat: RepeatOptions | null }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [repeating, setRepeating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(visit.targetInput);

  const canMove = visit.status !== "COMPLETED";
  const deltaDays =
    date && visit.targetInput
      ? Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${visit.targetInput}T00:00:00Z`)) / DAY_MS)
      : 0;

  function handleSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await moveVisit(visit.id, formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Couldn't move the visit."));
      }
    });
  }

  if (repeating && repeat) {
    return (
      <tr>
        <td colSpan={5} className="px-5 py-3">
          <p className="mb-2 text-sm font-medium">{t("Repeat {0}", [visit.visitType])}</p>
          <RepeatVisitForm
            visitId={visit.id}
            defaultName={visit.visitType}
            sourceDate={visit.targetInput}
            sourceTime={visit.startTime}
            windowBeforeDays={visit.windowBeforeDays}
            windowAfterDays={visit.windowAfterDays}
            subjectId={repeat.subjectId}
            patients={repeat.patients}
            onClose={() => setRepeating(false)}
          />
        </td>
      </tr>
    );
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={5} className="px-5 py-3">
          <form action={handleSave} className="space-y-2">
            <p className="text-sm font-medium">{visit.visitType}</p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-neutral-500">{t("New date")}</label>
                <input
                  type="date"
                  name="targetDate"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500">{t("Time (optional)")}</label>
                <input type="time" name="startTime" defaultValue={visit.startTime} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-neutral-500">{t("Window before (days)")}</label>
                <input
                  type="number"
                  name="windowBeforeDays"
                  min={0}
                  defaultValue={Math.max(0, visit.windowBeforeDays)}
                  className={`${inputClass} w-24`}
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500">{t("Window after (days)")}</label>
                <input
                  type="number"
                  name="windowAfterDays"
                  min={0}
                  defaultValue={Math.max(0, visit.windowAfterDays)}
                  className={`${inputClass} w-24`}
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
              >
                {pending ? t("Saving…") : t("Save")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDate(visit.targetInput);
                }}
                className="text-xs text-neutral-500 hover:underline"
              >
                {t("Cancel")}</button>
            </div>
            <label className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
              <input type="checkbox" name="moveLater" className="mt-0.5" />
              <span>
                {t("Also move this patient's later visits by the same number of days")}
                {deltaDays !== 0 && (
                  <span className="font-medium">
                    {" "}
                    {deltaDays > 0
                      ? t("({0} day later)|({0} days later)", [Math.abs(deltaDays)])
                      : t("({0} day earlier)|({0} days earlier)", [Math.abs(deltaDays)])}
                  </span>
                )}
              </span>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
      <td className="px-5 py-2">
        <Link
          href={`/dashboard/visits/${visit.id}`}
          title={t("Open this visit")}
          className="font-medium text-blue-700 hover:underline dark:text-blue-400"
        >
          {visit.visitType} →
        </Link>
      </td>
      <td className="px-5 py-2">{visit.targetLabel}</td>
      <td className="px-5 py-2 text-neutral-500">{visit.windowLabel}</td>
      <td className="px-5 py-2">
        <Badge value={visit.status} />
      </td>
      <td className="whitespace-nowrap px-5 py-2 text-right">
        <span className="inline-flex items-center gap-3">
          {canMove ? (
            <button type="button" onClick={() => setEditing(true)} className="text-xs hover:underline">
              {t("Edit dates")}</button>
          ) : (
            <span className="text-xs text-neutral-400">—</span>
          )}
          {repeat && (
            <button
              type="button"
              onClick={() => setRepeating(true)}
              title={t("Repeat or copy this visit →")}
              className="text-xs hover:underline"
            >
              {t("Repeat")}
            </button>
          )}
        </span>
      </td>
    </tr>
  );
}

export function PatientVisitsTable({ visits, repeat }: { visits: PatientVisit[]; repeat: RepeatOptions | null }) {
  const t = useT();
  return (
    <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
      <thead className="bg-neutral-50 dark:bg-neutral-900">
        <tr>
          <th className="px-5 py-2 text-left font-medium text-neutral-500">{t("Visit")}</th>
          <th className="px-5 py-2 text-left font-medium text-neutral-500">{t("Target date")}</th>
          <th className="px-5 py-2 text-left font-medium text-neutral-500">{t("Window")}</th>
          <th className="px-5 py-2 text-left font-medium text-neutral-500">{t("Status")}</th>
          <th className="px-5 py-2"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {visits.map((v) => (
          <VisitRow key={v.id} visit={v} repeat={repeat} />
        ))}
      </tbody>
    </table>
  );
}
