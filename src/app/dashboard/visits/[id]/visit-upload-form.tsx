"use client";

import { useRef, useState, useTransition } from "react";
import { uploadDocument } from "../../documents/actions";

const TYPES = ["PROTOCOL", "IB", "ICF", "DELEGATION_LOG", "TRAINING_RECORD", "OTHER"];

export function VisitUploadForm({ studyId, visitId }: { studyId: string; visitId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await uploadDocument(formData);
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add the document.");
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <input type="hidden" name="studyId" value={studyId} />
      <input type="hidden" name="visitId" value={visitId} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium">Type</label>
          <select
            name="type"
            required
            defaultValue="OTHER"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium">Version</label>
          <input
            name="version"
            required
            defaultValue="v1.0"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">Title</label>
          <input
            name="title"
            required
            placeholder="e.g. Source note, lab report"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">File (optional)</label>
          <input type="file" name="file" className="mt-1 w-full text-sm" />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Adding…" : "Add to this visit"}
      </button>
    </form>
  );
}
