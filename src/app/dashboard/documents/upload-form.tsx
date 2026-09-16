"use client";

import { useRef, useState, useTransition } from "react";
import { uploadDocument } from "./actions";

const TYPES = ["PROTOCOL", "IB", "ICF", "DELEGATION_LOG", "TRAINING_RECORD", "OTHER"];

export function UploadDocumentForm({
  studies,
}: {
  studies: { id: string; protocolId: string; title: string }[];
}) {
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
        setError(e instanceof Error ? e.message : "Upload failed.");
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <h2 className="text-sm font-medium text-neutral-500">Upload a document</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium">Study</label>
          <select
            name="studyId"
            required
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
          <label className="block text-xs font-medium">Type</label>
          <select
            name="type"
            required
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">Title</label>
          <input
            name="title"
            required
            placeholder="e.g. RCN-101 Protocol"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <p className="mt-1 text-xs text-neutral-400">
            Uploading the same study + type + title again supersedes the current version.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium">Version</label>
          <input
            name="version"
            required
            placeholder="v1.0"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">Expiry date (optional)</label>
          <input
            type="date"
            name="expiryDate"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">File</label>
          <input
            type="file"
            name="file"
            required
            className="mt-1 w-full text-sm"
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
