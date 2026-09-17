"use client";

import { useState, useTransition } from "react";
import { toggleChecklistItem } from "./checklist-actions";

export type ChecklistItem = {
  id: string;
  sortOrder: number;
  label: string;
  detail: string | null;
  verified: boolean;
};

export function VisitChecklist({ visitId, items }: { visitId: string; items: ChecklistItem[] }) {
  const [pending, startTransition] = useTransition();
  const [localItems, setLocalItems] = useState(items);

  function handleToggle(templateItemId: string, next: boolean) {
    setLocalItems((prev) => prev.map((i) => (i.id === templateItemId ? { ...i, verified: next } : i)));
    startTransition(async () => {
      await toggleChecklistItem(visitId, templateItemId, next);
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        No procedure checklist defined for this visit type yet — add one from the study&apos;s visit
        schedule page.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {localItems.map((item, i) => (
          <li key={item.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={item.verified}
              disabled={pending}
              onChange={(e) => handleToggle(item.id, e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="text-neutral-400">{i + 1}.</span> <span className="font-medium">{item.label}</span>
              {item.detail && <span className="text-neutral-500"> ({item.detail})</span>}
            </span>
          </li>
        ))}
      </ul>
      <a
        href={`/api/visits/${visitId}/checklist-docx`}
        className="block border-t border-neutral-200 px-4 py-2.5 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
      >
        Download filled checklist (.docx)
      </a>
    </div>
  );
}
