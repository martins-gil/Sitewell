"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addVisit } from "@/app/dashboard/visits/actions";
import { humanizeEnum } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

export type SchedulingStudy = { id: string; protocolId: string; title: string };
export type SchedulingTemplate = {
  id: string;
  studyId: string;
  name: string;
  windowBeforeDays: number;
  windowAfterDays: number;
};
export type SchedulingSubject = {
  id: string;
  studyId: string;
  subjectCode: string;
  displayName: string | null;
  status: string;
  scheduledTemplateIds: string[];
};

const CUSTOM = "custom";

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";

/**
 * Adds one visit to a patient's program. On the calendar it's a cascade —
 * study, then a patient in that study, then one of the study's visit types
 * that patient doesn't have yet (or a custom-named visit), then the date. On
 * a patient's own page the study and patient are fixed. The selects are
 * "controlled with a fallback": if the current choice stops being valid
 * (changed study, or a visit type just got scheduled), it falls back to the
 * first valid option instead of needing an effect to reset it.
 */
export function AddVisitForm({
  studies,
  subjects,
  templates,
  fixedSubjectId,
  initialStudyId,
  initialDate,
  onClose,
}: {
  studies: SchedulingStudy[];
  subjects: SchedulingSubject[];
  templates: SchedulingTemplate[];
  fixedSubjectId?: string;
  initialStudyId?: string;
  initialDate?: string;
  onClose: () => void;
}) {
  const t = useT();
  const fixedSubject = fixedSubjectId ? subjects.find((s) => s.id === fixedSubjectId) : undefined;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ id: string; label: string } | null>(null);
  const [pickedStudyId, setPickedStudyId] = useState(initialStudyId ?? "");
  const [pickedSubjectId, setPickedSubjectId] = useState("");
  const [pickedChoice, setPickedChoice] = useState("");

  const studyId = fixedSubject?.studyId ?? (studies.some((s) => s.id === pickedStudyId) ? pickedStudyId : (studies[0]?.id ?? ""));
  const subjectsForStudy = subjects.filter((s) => s.studyId === studyId);
  const subject =
    fixedSubject ??
    (subjectsForStudy.find((s) => s.id === pickedSubjectId) ?? subjectsForStudy[0]);

  const availableTemplates = templates.filter(
    (tpl) => tpl.studyId === studyId && !subject?.scheduledTemplateIds.includes(tpl.id),
  );
  const choice =
    pickedChoice === CUSTOM || availableTemplates.some((tpl) => tpl.id === pickedChoice)
      ? pickedChoice
      : (availableTemplates[0]?.id ?? CUSTOM);
  const chosenTemplate = availableTemplates.find((tpl) => tpl.id === choice);

  function handleSubmit(formData: FormData) {
    setError(null);
    setAdded(null);
    startTransition(async () => {
      try {
        const result = await addVisit(formData);
        const label = choice === CUSTOM ? String(formData.get("customName") ?? "Visit") : (chosenTemplate?.name ?? "Visit");
        setAdded({ id: result.id, label: `${subject?.subjectCode ?? ""} · ${label}` });
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Failed to add the visit."));
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-500">
          {fixedSubject ? t("Add a visit for {0}", [fixedSubject.subjectCode]) : t("Add a visit to the schedule")}
        </h2>
        <button type="button" onClick={onClose} className="text-xs text-neutral-500 hover:underline">
          {t("Close")}</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {!fixedSubject && (
          <>
            <div>
              <label className="block text-xs font-medium">{t("Study")}</label>
              <select
                value={studyId}
                onChange={(e) => {
                  setPickedStudyId(e.target.value);
                  setPickedSubjectId("");
                  setPickedChoice("");
                }}
                className={inputClass}
              >
                {studies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.protocolId} — {s.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium">{t("Patient")}</label>
              <select
                value={subject?.id ?? ""}
                onChange={(e) => {
                  setPickedSubjectId(e.target.value);
                  setPickedChoice("");
                }}
                disabled={subjectsForStudy.length === 0}
                className={inputClass}
              >
                {subjectsForStudy.length === 0 && <option value="">{t("No eligible patients")}</option>}
                {subjectsForStudy.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.subjectCode}
                    {s.displayName ? ` (${s.displayName})` : ""} · {t(humanizeEnum(s.status))}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <input type="hidden" name="subjectId" value={subject?.id ?? ""} />
        <input type="hidden" name="templateId" value={choice === CUSTOM ? "" : choice} />

        <div>
          <label className="block text-xs font-medium">{t("Visit")}</label>
          <select value={choice} onChange={(e) => setPickedChoice(e.target.value)} className={inputClass}>
            {availableTemplates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
            <option value={CUSTOM}>{t("Other — name it myself")}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Visit date")}</label>
          <input
            key={initialDate ?? "no-date"}
            type="date"
            name="targetDate"
            required
            defaultValue={initialDate}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium">{t("Time (optional)")}</label>
          <input type="time" name="startTime" className={inputClass} />
        </div>

        {choice === CUSTOM && (
          <div className="col-span-2">
            <label className="block text-xs font-medium">{t("Visit name")}</label>
            <input name="customName" required placeholder={t("e.g. Unscheduled visit")} className={inputClass} />
          </div>
        )}

        <div key={choice} className="col-span-2 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium">{t("Window before (days)")}</label>
            <input
              type="number"
              name="windowBeforeDays"
              min={0}
              defaultValue={chosenTemplate?.windowBeforeDays ?? 0}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium">{t("Window after (days)")}</label>
            <input
              type="number"
              name="windowAfterDays"
              min={0}
              defaultValue={chosenTemplate?.windowAfterDays ?? 0}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {subjectsForStudy.length === 0 && !fixedSubject && (
        <p className="text-xs text-neutral-500">
          {t("No patients in this study are pre-screened, screened, consented or enrolled yet.")}</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {added && (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("Added {0}.", [added.label])}{" "}
          <Link href={`/dashboard/visits/${added.id}`} className="underline">
            {t("Open visit →")}</Link>
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !subject}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t("Adding…") : t("Add visit")}
      </button>
    </form>
  );
}
