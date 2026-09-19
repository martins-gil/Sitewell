"use client";

import { useState, useTransition } from "react";
import { addIeCriterion, removeIeCriterion, setIeCriterionStatus } from "./actions";

// met: true / false / null (not assessed yet — e.g. cloned from another patient)
type IeCriterion = { criterion: string; met: boolean | null };

const STATUS_STYLE = {
  met: "text-green-700 dark:text-green-400",
  notMet: "text-red-700 dark:text-red-400",
  notAssessed: "text-neutral-500",
};

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

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleAdd(met: boolean | null) {
    if (!text.trim()) {
      setError("Enter the criterion text first.");
      return;
    }
    run(async () => {
      await addIeCriterion(subjectId, text, met);
      setText("");
    });
  }

  const statusButton = (active: boolean) =>
    `rounded px-1.5 py-0.5 text-[11px] ${
      active
        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
        : "border border-neutral-300 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
    }`;

  return (
    <div>
      <ul className="space-y-1.5 text-sm">
        {initialCriteria.map((c, i) => (
          <li key={i} className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={c.met === true ? STATUS_STYLE.met : c.met === false ? STATUS_STYLE.notMet : STATUS_STYLE.notAssessed}
            >
              {c.met === true ? "✓" : c.met === false ? "✗" : "○"} {c.criterion}
            </span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setIeCriterionStatus(subjectId, i, true))}
                className={statusButton(c.met === true)}
              >
                Met
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setIeCriterionStatus(subjectId, i, false))}
                className={statusButton(c.met === false)}
              >
                Not met
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setIeCriterionStatus(subjectId, i, null))}
                className={statusButton(c.met === null)}
                title="Not assessed yet"
              >
                ?
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => removeIeCriterion(subjectId, i))}
                className="px-1 text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
                aria-label={`Remove ${c.criterion}`}
              >
                ×
              </button>
            </span>
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
        <button
          type="button"
          disabled={pending}
          onClick={() => handleAdd(null)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm text-neutral-600 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-400"
          title="Add without deciding yet"
        >
          + Not assessed
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
