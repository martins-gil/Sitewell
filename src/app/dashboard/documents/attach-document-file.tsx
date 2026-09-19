"use client";

import { useState, useTransition } from "react";
import { attachDocumentFile } from "./actions";

/** For a document logged without a file: pick one and attach it. */
export function AttachDocumentFile({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await attachDocumentFile(documentId, formData);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to attach the file.");
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs hover:underline">
        Attach file
      </button>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input type="file" name="file" required className="max-w-[14rem] text-xs" />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Attaching…" : "Attach"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
        Cancel
      </button>
      {error && <span className="w-full max-w-xs text-xs text-red-600">{error}</span>}
    </form>
  );
}
