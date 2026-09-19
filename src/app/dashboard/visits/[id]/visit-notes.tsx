"use client";

import { useState, useTransition } from "react";
import { saveVisitNotes } from "../actions";

/** Free-text notes for the visit — printed as "Notas:" at the end of both the
 * procedure checklist and the nursing record. Synthetic data only until Phase 5. */
export function VisitNotes({ visitId, notes }: { visitId: string; notes: string }) {
  const [value, setValue] = useState(notes);
  const [saved, setSaved] = useState(notes);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Same render-time reset as the checklist: pick up the server's value if it changes underneath us.
  const [prevNotes, setPrevNotes] = useState(notes);
  if (notes !== prevNotes) {
    setPrevNotes(notes);
    setValue(notes);
    setSaved(notes);
  }

  const dirty = value.trim() !== saved.trim();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveVisitNotes(visitId, value);
        setSaved(value);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save notes.");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        placeholder="Anything worth recording about this visit — deviations, late arrival, follow-ups…"
        aria-label="Visit notes"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !dirty}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Saving…" : "Save notes"}
        </button>
        <span className="text-xs text-neutral-500">
          {dirty ? "Unsaved changes" : "Printed as “Notas:” on the checklist and nursing sheet."} Test data only — no
          real patient information.
        </span>
      </div>
    </div>
  );
}
