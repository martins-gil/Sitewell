"use client";

import { useRef, useState, useTransition } from "react";
import { ChecklistTextImport } from "@/components/checklist-text-import";
import { useT } from "@/lib/i18n/client";
import {
  addMonitoringPoint,
  addMonitoringPoints,
  copyMonitoringPoints,
  removeMonitoringPoint,
  setMonitoringPointVerified,
} from "../actions";

export type MonitoringPointRow = { id: string; label: string; detail: string | null; verified: boolean };

const inputClass =
  "rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";

/**
 * The points to verify during the monitoring visit — the same idea as a patient
 * visit's procedure checklist: tick each one as it is checked, add or remove
 * points, paste a list, or start from an earlier visit's points. The printable
 * document is the download link at the bottom.
 */
export function MonitoringPoints({
  id,
  items,
  sources,
}: {
  id: string;
  items: MonitoringPointRow[];
  // Earlier monitoring visits of the same study whose points can be copied here.
  sources: { id: string; label: string; points: number }[];
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(items);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Keep in step with the server's list after an add / copy / import refreshes the page.
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setLocal(items);
  }

  function handleToggle(itemId: string, next: boolean) {
    setLocal((prev) => prev.map((i) => (i.id === itemId ? { ...i, verified: next } : i)));
    startTransition(async () => {
      await setMonitoringPointVerified(id, itemId, next);
    });
  }

  function handleRemove(itemId: string) {
    setLocal((prev) => prev.filter((i) => i.id !== itemId));
    startTransition(async () => {
      await removeMonitoringPoint(id, itemId);
    });
  }

  function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await addMonitoringPoint(id, formData);
        if (result.ok) {
          formRef.current?.reset();
          setAdding(false);
        } else setError(result.problem);
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  function handleCopy(fromId: string) {
    if (!fromId) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await copyMonitoringPoints(id, fromId);
        if (!result.ok) setError(result.problem);
        else setNotice(result.added === 0 ? t("Nothing new to add — they're already on the list.") : t("{0} point added.|{0} points added.", [result.added]));
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      {local.length === 0 ? (
        <p className="px-4 py-3 text-sm text-neutral-400">
          {t("No points to verify yet — add them below, paste a list, or copy them from an earlier monitoring visit.")}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {local.map((item, i) => (
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
              </span>
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                disabled={pending}
                className="text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
              >
                {t("Remove")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        {adding ? (
          <form ref={formRef} onSubmit={handleAdd} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input name="label" required placeholder={t("Point to verify")} className={inputClass} />
              <input name="detail" placeholder={t("Detail (optional)")} className={inputClass} />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
              >
                {t("Add point")}
              </button>
              <button type="button" onClick={() => setAdding(false)} className="text-xs text-neutral-500 hover:underline">
                {t("Cancel")}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
            >
              {t("+ Add a point to verify")}
            </button>
            <ChecklistTextImport
              saveLabel={t("Add these points")}
              texts={{
                open: t("Paste a list of points"),
                heading: t("Paste the points to verify"),
                placeholder: t("Paste the points here, one per line or as a list — for example from the monitoring plan."),
                none: t("No points were found in that text."),
                added: (n) => t("{0} point added.|{0} points added.", [n]),
              }}
              onSave={async (list) => {
                const result = await addMonitoringPoints(id, list);
                if (!result.ok) throw new Error(result.problem);
                return { added: result.added };
              }}
            />
            {sources.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label htmlFor="copy-points" className="text-neutral-600 dark:text-neutral-400">
                  {t("Copy the points of an earlier visit:")}
                </label>
                <select
                  id="copy-points"
                  defaultValue=""
                  disabled={pending}
                  onChange={(e) => {
                    handleCopy(e.target.value);
                    e.target.value = "";
                  }}
                  className={inputClass}
                >
                  <option value="">{t("Choose…")}</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} — {t("{0} point|{0} points", [s.points])}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
        {notice && <p className="text-xs text-green-700 dark:text-green-400">{notice}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <a
        href={`/api/monitoring/${id}/docx`}
        className="block border-t border-neutral-200 px-4 py-2.5 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
      >
        {t("Download points to verify (.docx)")}
      </a>
    </div>
  );
}
