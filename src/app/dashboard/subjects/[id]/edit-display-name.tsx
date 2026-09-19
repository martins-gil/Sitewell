"use client";

import { useState, useTransition } from "react";
import { updateSubjectDisplayName } from "./actions";

export function EditDisplayName({ subjectId, initial }: { subjectId: string; initial: string | null }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateSubjectDisplayName(subjectId, String(formData.get("displayName") ?? ""));
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  if (!editing) {
    return (
      <p className="text-sm text-neutral-500">
        Initials / name: <span className="text-neutral-800 dark:text-neutral-200">{initial ?? "—"}</span>{" "}
        <button type="button" onClick={() => setEditing(true)} className="text-xs hover:underline">
          Edit
        </button>
      </p>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        name="displayName"
        defaultValue={initial ?? ""}
        placeholder="e.g. M.C."
        className="rounded-md border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-neutral-500 hover:underline">
        Cancel
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}
