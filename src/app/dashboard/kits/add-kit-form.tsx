"use client";

import { useRef, useState, useTransition } from "react";
import { addKit } from "./actions";

type Study = { id: string; protocolId: string; templates: { id: string; name: string }[] };

export function AddKitForm({ studies }: { studies: Study[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [studyId, setStudyId] = useState(studies[0]?.id ?? "");

  const selectedStudy = studies.find((s) => s.id === studyId);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addKit(formData);
        formRef.current?.reset();
        setStudyId(studies[0]?.id ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add kit.");
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <h2 className="text-sm font-medium text-neutral-500">Add a kit</h2>
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
                {s.protocolId}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium">Assigned visit (optional)</label>
          <select
            name="visitScheduleTemplateId"
            defaultValue=""
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            <option value="">Not visit-specific</option>
            {selectedStudy?.templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">Kit name</label>
          <input
            name="name"
            required
            placeholder="e.g. Baseline blood draw kits, Lot #4521"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">Expiry date</label>
          <input
            type="date"
            name="expiryDate"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending || !studyId}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Adding…" : "Add kit"}
      </button>
    </form>
  );
}
