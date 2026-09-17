"use client";

import { useState, useTransition } from "react";
import { addIeCriterion } from "./actions";

type IeCriterion = { criterion: string; met: boolean };

export function IeCriteriaEditor({
  subjectId,
  initialCriteria,
}: {
  subjectId: string;
  initialCriteria: IeCriterion[];
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd(met: boolean) {
    if (!text.trim()) {
      setError("Enter the criterion text first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addIeCriterion(subjectId, text, met);
        setText("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add.");
      }
    });
  }

  return (
    <div>
      <ul className="space-y-1 text-sm">
        {initialCriteria.map((c, i) => (
          <li
            key={i}
            className={c.met ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}
          >
            {c.met ? "✓" : "✗"} {c.criterion}
          </li>
        ))}
        {initialCriteria.length === 0 && <li className="text-neutral-400">No criteria recorded.</li>}
      </ul>

      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. No prior investigational treatment"
          disabled={pending}
          className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => handleAdd(true)}
          className="rounded-md bg-green-100 px-2 py-1 text-sm font-medium text-green-800 disabled:opacity-60 dark:bg-green-950 dark:text-green-300"
        >
          + Met
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => handleAdd(false)}
          className="rounded-md bg-red-100 px-2 py-1 text-sm font-medium text-red-800 disabled:opacity-60 dark:bg-red-950 dark:text-red-300"
        >
          + Not met
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
