"use client";

import { useState, useTransition } from "react";
import {
  AddVisitForm,
  type SchedulingSubject,
  type SchedulingTemplate,
} from "@/components/add-visit-form";
import { generateProtocolSchedule } from "@/app/dashboard/visits/actions";
import { useT } from "@/lib/i18n/client";

/**
 * The "build this patient's program" controls on the patient page: add one
 * visit at a time, or fill in the whole protocol schedule from a Day 0 date
 * (only the visit types the patient doesn't already have).
 */
export function VisitScheduler({
  subject,
  templates,
}: {
  subject: SchedulingSubject;
  templates: SchedulingTemplate[];
}) {
  const t = useT();
  const [mode, setMode] = useState<"none" | "add" | "generate">("none");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleGenerate(formData: FormData) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const { created } = await generateProtocolSchedule(subject.id, String(formData.get("anchorDate") ?? ""));
        setMessage(
          created === 0
            ? t("Every protocol visit is already on this patient's schedule.")
            : t("Added {0} protocol visit.|Added {0} protocol visits.", [created]),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Failed to generate the schedule."));
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode(mode === "add" ? "none" : "add")}
          className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          {t("+ Add a visit")}</button>
        <button
          type="button"
          onClick={() => setMode(mode === "generate" ? "none" : "generate")}
          className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {t("Add all protocol visits from a date")}</button>
      </div>

      {mode === "add" && (
        <AddVisitForm
          studies={[]}
          subjects={[subject]}
          templates={templates}
          fixedSubjectId={subject.id}
          onClose={() => setMode("none")}
        />
      )}

      {mode === "generate" && (
        <form
          action={handleGenerate}
          className="space-y-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <p className="text-xs text-neutral-500">
            {t("Creates every visit type in the study's visit schedule that this patient doesn't have yet, dated from the day you enter as Day 0 (Baseline) using each visit's offset from the protocol. Adjust individual dates afterwards from each visit's Reschedule action.")}</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium">{t("Day 0 (Baseline) date")}</label>
              <input
                type="date"
                name="anchorDate"
                required
                className="mt-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
            >
              {pending ? t("Adding…") : t("Add protocol visits")}
            </button>
            <button type="button" onClick={() => setMode("none")} className="text-xs text-neutral-500 hover:underline">
              {t("Close")}</button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-700 dark:text-green-400">{message}</p>}
        </form>
      )}
    </div>
  );
}
