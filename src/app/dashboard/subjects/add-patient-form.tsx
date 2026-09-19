"use client";

import { useState, useTransition } from "react";
import type { DuplicationSource } from "@/lib/queries";
import { addSubject } from "./actions";

type Study = { id: string; protocolId: string; title: string };

// One visit copied from the source patient, editable before the new patient
// is created.
type PlanRow = {
  key: string;
  visitType: string;
  templateId: string | null;
  targetDate: string; // YYYY-MM-DD
  windowBeforeDays: number;
  windowAfterDays: number;
  include: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function shiftDate(iso: string, days: number): string {
  if (!iso) return iso;
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";
const cellInput =
  "w-full rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950";

export function AddPatientForm({ studies, sources }: { studies: Study[]; sources: DuplicationSource[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [studyId, setStudyId] = useState(studies[0]?.id ?? "");
  const [sourceId, setSourceId] = useState("");
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [copyCriteria, setCopyCriteria] = useState(true);
  const [shiftTo, setShiftTo] = useState("");

  const sourcesForStudy = sources.filter(
    (s) => s.studyId === studyId && (s.visits.length > 0 || s.criteria.length > 0),
  );
  const source = sourcesForStudy.find((s) => s.id === sourceId);

  function chooseSource(id: string) {
    const next = sources.find((s) => s.id === id);
    setSourceId(id);
    setCopyCriteria(true);
    setShiftTo("");
    setRows(
      next
        ? next.visits.map((v) => ({
            key: v.id,
            visitType: v.visitType,
            templateId: v.templateId,
            targetDate: v.targetDate,
            windowBeforeDays: v.windowBeforeDays,
            windowAfterDays: v.windowAfterDays,
            include: true,
          }))
        : [],
    );
  }

  function updateRow(key: string, patch: Partial<PlanRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  // Moves the whole schedule so its earliest included visit lands on
  // `shiftTo`, keeping every gap between visits as it was.
  function applyShift() {
    const dates = rows.filter((r) => r.include && r.targetDate).map((r) => r.targetDate).sort();
    if (!shiftTo || dates.length === 0) return;
    const delta = Math.round((Date.parse(`${shiftTo}T00:00:00Z`) - Date.parse(`${dates[0]}T00:00:00Z`)) / DAY_MS);
    setRows((prev) => prev.map((r) => ({ ...r, targetDate: shiftDate(r.targetDate, delta) })));
  }

  const plan = rows
    .filter((r) => r.include)
    .map((r) => ({
      templateId: r.templateId,
      visitType: r.visitType,
      targetDate: r.targetDate,
      windowBeforeDays: r.windowBeforeDays,
      windowAfterDays: r.windowAfterDays,
    }));

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addSubject(formData);
      } catch (e) {
        // redirect() throws internally on success — only real errors land here.
        setError(e instanceof Error ? e.message : "Failed to add patient.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        + Add patient
      </button>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-500">Add a patient</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Synthetic/test data only — every patient created here is flagged as test data, per
        PROJECT_SPEC.md&apos;s Phase 5 gate on real subject data.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium">Study</label>
          <select
            name="studyId"
            required
            value={studyId}
            onChange={(e) => {
              setStudyId(e.target.value);
              chooseSource("");
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
          <label className="block text-xs font-medium">Subject code (optional)</label>
          <input name="subjectCode" placeholder="Auto-generated if left blank" className={inputClass} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">Initials / name (optional)</label>
          <input name="displayName" placeholder="e.g. M.C." className={inputClass} />
          <p className="mt-1 text-xs text-neutral-500">
            Test data only for now — don&apos;t enter a real patient&apos;s name or initials until the
            Phase 5 compliance work is done.
          </p>
        </div>

        <div className="col-span-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <label className="block text-xs font-medium">Copy from an existing patient (optional)</label>
          <select value={sourceId} onChange={(e) => chooseSource(e.target.value)} className={inputClass}>
            <option value="">Start empty — don&apos;t copy anything</option>
            {sourcesForStudy.map((s) => (
              <option key={s.id} value={s.id}>
                {s.subjectCode}
                {s.displayName ? ` (${s.displayName})` : ""} — {s.visits.length} visit
                {s.visits.length === 1 ? "" : "s"}, {s.criteria.length} eligibility criteri
                {s.criteria.length === 1 ? "on" : "a"}
              </option>
            ))}
          </select>
        </div>

        {source && (
          <>
            <input type="hidden" name="duplicateFromSubjectId" value={source.id} />
            <input type="hidden" name="visitPlan" value={JSON.stringify(plan)} />

            {source.criteria.length > 0 && (
              <label className="col-span-2 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="copyCriteria"
                  checked={copyCriteria}
                  onChange={(e) => setCopyCriteria(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Copy the eligibility criteria ({source.criteria.length})
                  <span className="block text-xs text-neutral-500">
                    Only the list is copied — each one starts as ○ not assessed for the new patient, to be marked
                    met / not met.
                  </span>
                </span>
              </label>
            )}

            {rows.length > 0 && (
              <div className="col-span-2 space-y-2">
                <p className="text-xs font-medium">Visits to copy — set this patient&apos;s dates and windows</p>

                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-xs text-neutral-500">Start the schedule on</label>
                    <input
                      type="date"
                      value={shiftTo}
                      onChange={(e) => setShiftTo(e.target.value)}
                      className="mt-1 rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applyShift}
                    disabled={!shiftTo}
                    className="rounded-md border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    Shift all dates
                  </button>
                  <span className="text-xs text-neutral-500">
                    The earliest visit moves there; the others keep the same gaps. You can still adjust each one.
                  </span>
                </div>

                <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
                  <table className="min-w-full text-sm">
                    <thead className="bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-neutral-900">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">Include</th>
                        <th className="px-2 py-1.5 font-medium">Visit</th>
                        <th className="px-2 py-1.5 font-medium">Date</th>
                        <th className="px-2 py-1.5 font-medium">Window before (days)</th>
                        <th className="px-2 py-1.5 font-medium">Window after (days)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {rows.map((r) => (
                        <tr key={r.key} className={r.include ? undefined : "opacity-50"}>
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={r.include}
                              onChange={(e) => updateRow(r.key, { include: e.target.checked })}
                              aria-label={`Include ${r.visitType}`}
                            />
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5">{r.visitType}</td>
                          <td className="px-2 py-1.5">
                            <input
                              type="date"
                              required={r.include}
                              disabled={!r.include}
                              value={r.targetDate}
                              onChange={(e) => updateRow(r.key, { targetDate: e.target.value })}
                              className={cellInput}
                            />
                          </td>
                          <td className="w-28 px-2 py-1.5">
                            <input
                              type="number"
                              min={0}
                              disabled={!r.include}
                              value={r.windowBeforeDays}
                              onChange={(e) => updateRow(r.key, { windowBeforeDays: Number(e.target.value) })}
                              className={cellInput}
                            />
                          </td>
                          <td className="w-28 px-2 py-1.5">
                            <input
                              type="number"
                              min={0}
                              disabled={!r.include}
                              value={r.windowAfterDays}
                              onChange={(e) => updateRow(r.key, { windowAfterDays: Number(e.target.value) })}
                              className={cellInput}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-neutral-500">
                  These become the new patient&apos;s scheduled visits, so they show up on the calendar. Status,
                  actual dates, checklists and documents from the source patient are not copied.
                </p>
              </div>
            )}
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Adding…" : "Add patient"}
      </button>
    </form>
  );
}
