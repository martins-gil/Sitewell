"use client";

import { useState, useTransition } from "react";
import { deleteVisit } from "../actions";

export function DeleteVisitButton({ visitId, label }: { visitId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!window.confirm(`Remove ${label}? This can't be undone.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteVisit(visitId);
      } catch (e) {
        // A successful delete redirects, which surfaces here as a thrown
        // redirect — only real failures carry a message worth showing.
        const message = e instanceof Error ? e.message : "";
        if (!message.includes("NEXT_REDIRECT")) setError(message || "Failed to remove the visit.");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
      >
        {pending ? "Removing…" : "Remove this visit"}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
