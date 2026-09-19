"use client";

import { useState, useTransition } from "react";
import { assignKitToVisit, markKitUsed } from "@/app/dashboard/kits/actions";
import { useT } from "@/lib/i18n/client";

export type VisitKit = { id: string; name: string; expiryLabel: string; used: boolean };
export type AvailableKit = { id: string; label: string };

export function VisitKits({
  visitId,
  kits,
  availableKits,
  visitOccurred,
}: {
  visitId: string;
  kits: VisitKit[];
  availableKits: AvailableKit[];
  visitOccurred: boolean;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickedKitId, setPickedKitId] = useState("");

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setPickedKitId("");
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Something went wrong."));
      }
    });
  }

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      {kits.length === 0 ? (
        <p className="px-4 py-3 text-sm text-neutral-400">{t("No kits assigned to this visit yet.")}</p>
      ) : (
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {kits.map((kit) => (
            <li key={kit.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className={kit.used ? "opacity-60" : undefined}>
                <span className="font-medium">{kit.name}</span>{" "}
                <span className="text-neutral-500">{t("· expires {0}", [kit.expiryLabel])}</span>
                {kit.used && <span className="ml-2 text-xs text-neutral-500">{t("(used — removed from inventory)")}</span>}
              </span>
              {!kit.used && (
                <span className="flex items-center gap-3">
                  {visitOccurred && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => markKitUsed(kit.id))}
                      className="text-xs font-medium hover:underline disabled:opacity-60"
                    >
                      {t("Remove from inventory (used)")}</button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => assignKitToVisit(kit.id, null))}
                    className="text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
                  >
                    {t("Unassign")}</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <select
          value={pickedKitId}
          onChange={(e) => setPickedKitId(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">
            {availableKits.length === 0 ? t("No unassigned kits for this study") : t("Assign a kit from inventory…")}
          </option>
          {availableKits.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !pickedKitId}
          onClick={() => run(() => assignKitToVisit(pickedKitId, visitId))}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          {t("Assign")}</button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
