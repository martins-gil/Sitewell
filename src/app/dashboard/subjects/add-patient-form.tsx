"use client";

import { useState, useTransition } from "react";
import { addSubject } from "./actions";

type Study = { id: string; protocolId: string; title: string };
type DuplicateCandidate = { id: string; subjectCode: string; studyId: string; visitCount: number };

export function AddPatientForm({
  studies,
  duplicateCandidates,
}: {
  studies: Study[];
  duplicateCandidates: DuplicateCandidate[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [studyId, setStudyId] = useState(studies[0]?.id ?? "");

  const candidatesForStudy = duplicateCandidates.filter(
    (c) => c.studyId === studyId && c.visitCount > 0,
  );

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
            onChange={(e) => setStudyId(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
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
          <input
            name="subjectCode"
            placeholder="Auto-generated if left blank"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">Initials / name (optional)</label>
          <input
            name="displayName"
            placeholder="e.g. M.C."
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Test data only for now — don&apos;t enter a real patient&apos;s name or initials until the
            Phase 5 compliance work is done.
          </p>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">Duplicate visits from (optional)</label>
          <select
            name="duplicateFromSubjectId"
            defaultValue=""
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            <option value="">Don&apos;t copy a visit schedule</option>
            {candidatesForStudy.map((c) => (
              <option key={c.id} value={c.id}>
                {c.subjectCode} ({c.visitCount} visit{c.visitCount === 1 ? "" : "s"})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-500">
            Copies that patient&apos;s visit types and dates onto this new one as a starting point —
            adjust each date afterwards from the visit&apos;s Reschedule action.
          </p>
        </div>
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
