"use client";

import { useRef, useState, useTransition } from "react";
import {
  toggleChecklistItem,
  setChecklistItemTime,
  addVisitChecklistItem,
  removeVisitChecklistItem,
} from "./checklist-actions";
import { useT } from "@/lib/i18n/client";
import { ChecklistTextImport } from "@/components/checklist-text-import";
import { addVisitChecklistItemsBulk } from "@/app/dashboard/bulk-checklist-actions";

export type ChecklistItem = {
  id: string;
  sortOrder: number;
  label: string;
  detail: string | null;
  verified: boolean;
  // "YYYY-MM-DDTHH:mm" as a datetime-local input wants it, or "" when unset.
  performedAt: string;
  isAdHoc: boolean;
};

// The browser's current wall-clock time in the same "floating" form the
// times are stored in (see parseDateTimeInput).
function nowInputValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function VisitChecklist({
  visitId,
  items,
  column,
}: {
  visitId: string;
  items: ChecklistItem[];
  // What this visit type's printed checklist records per procedure: a tick, or when it was done.
  column: "VERIFIED" | "DATETIME";
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [localItems, setLocalItems] = useState(items);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Adding an item doesn't touch localItems optimistically (unlike toggling
  // or removing) — it relies on the server action's revalidatePath causing
  // Next to refetch this page's data and pass a new `items` prop. Sync that
  // in during render (React's documented pattern for resetting state from a
  // changed prop) rather than in an effect, which would otherwise commit a
  // stale render first and then trigger a second one.
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setLocalItems(items);
  }

  function handleToggle(resultId: string, next: boolean) {
    setLocalItems((prev) =>
      prev.map((i) => (i.id === resultId ? { ...i, verified: next, performedAt: next ? i.performedAt : "" } : i)),
    );
    startTransition(async () => {
      await toggleChecklistItem(visitId, resultId, next);
    });
  }

  function handleTime(resultId: string, value: string) {
    setLocalItems((prev) =>
      prev.map((i) => (i.id === resultId ? { ...i, performedAt: value, verified: value ? true : i.verified } : i)),
    );
    startTransition(async () => {
      await setChecklistItemTime(visitId, resultId, value);
    });
  }

  function handleRemove(resultId: string) {
    setLocalItems((prev) => prev.filter((i) => i.id !== resultId));
    startTransition(async () => {
      await removeVisitChecklistItem(visitId, resultId);
    });
  }

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addVisitChecklistItem(visitId, formData);
        formRef.current?.reset();
        setAdding(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Failed to add procedure."));
      }
    });
  }

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      {localItems.length === 0 ? (
        <p className="px-4 py-3 text-sm text-neutral-400">
          {t("No procedures on this visit yet — add one below, or add one to the study's visit schedule template so it applies to every subject's visit of this type.")}</p>
      ) : (
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
              <span className="flex-1">
                <span className="text-neutral-400">{i + 1}.</span> <span className="font-medium">{item.label}</span>
                {item.detail && <span className="text-neutral-500"> ({item.detail})</span>}
                {item.isAdHoc && (
                  <span className="ml-2 text-xs text-neutral-400">{t("(added to this visit only)")}</span>
                )}
              </span>
              {column === "DATETIME" && (
                <span className="flex items-center gap-1.5">
                  <input
                    type="datetime-local"
                    value={item.performedAt}
                    disabled={pending}
                    onChange={(e) => handleTime(item.id, e.target.value)}
                    aria-label={t("Date and time of {0}", [item.label])}
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  <button
                    type="button"
                    onClick={() => handleTime(item.id, nowInputValue())}
                    disabled={pending}
                    className="text-xs text-neutral-600 hover:underline disabled:opacity-60 dark:text-neutral-400"
                  >
                    {t("Now")}</button>
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                disabled={pending}
                className="text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
              >
                {t("Remove")}</button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        {adding ? (
          <form ref={formRef} action={handleAdd} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                name="label"
                required
                placeholder={t("Procedure name")}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
              <input
                name="detail"
                placeholder={t("Detail (optional)")}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
              >
                {t("Add to this visit")}</button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="text-xs text-neutral-500 hover:underline"
              >
                {t("Cancel")}</button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
            >
              {t("+ Add a procedure to this visit")}</button>
            <ChecklistTextImport
              saveLabel={t("Add these to this visit")}
              onSave={(list) => addVisitChecklistItemsBulk(visitId, list)}
            />
          </div>
        )}
      </div>

      <a
        href={`/api/visits/${visitId}/checklist-docx`}
        className="block border-t border-neutral-200 px-4 py-2.5 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
      >
        {column === "DATETIME" ? t("Download checklist with date and time (.docx)") : t("Download filled checklist (.docx)")}
      </a>
    </div>
  );
}
