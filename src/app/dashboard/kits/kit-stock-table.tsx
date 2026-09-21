"use client";

import { useTransition } from "react";
import { markKitsRequested, unmarkKitsRequested } from "./actions";
import { useT } from "@/lib/i18n/client";

export type StockRow = {
  studyId: string;
  protocolId: string;
  title: string;
  available: number;
  assigned: number;
  expired: number;
  used: number;
  outOfStock: boolean;
  requestedLabel: string | null;
};

/**
 * How many kits each study has left. Assigning a kit to a patient's visit moves it from
 * Available to Assigned; when nothing is available any more the study shows "No kits
 * left" (and the orange bar asks for more) until someone marks them as requested.
 */
export function KitStockTable({ rows }: { rows: StockRow[] }) {
  const t = useT();
  const [pending, startTransition] = useTransition();

  const number = "px-4 py-2 text-right tabular-nums";

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
        <thead className="bg-neutral-50 dark:bg-neutral-900">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Study")}</th>
            <th className="px-4 py-2 text-right font-medium text-neutral-500">{t("Available")}</th>
            <th className="px-4 py-2 text-right font-medium text-neutral-500">{t("Assigned")}</th>
            <th className="px-4 py-2 text-right font-medium text-neutral-500">{t("Expired")}</th>
            <th className="px-4 py-2 text-right font-medium text-neutral-500">{t("Used")}</th>
            <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Stock")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {rows.map((row) => (
            <tr key={row.studyId}>
              <td className="px-4 py-2">
                <span className="font-medium">{row.protocolId}</span>
                {row.title !== row.protocolId && <span className="ml-2 text-xs text-neutral-500">{row.title}</span>}
              </td>
              <td
                className={`${number} font-semibold ${
                  row.available === 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"
                }`}
              >
                {row.available}
              </td>
              <td className={number}>{row.assigned}</td>
              <td className={`${number} ${row.expired > 0 ? "text-red-600 dark:text-red-400" : "text-neutral-500"}`}>
                {row.expired}
              </td>
              <td className={`${number} text-neutral-500`}>{row.used}</td>
              <td className="px-4 py-2">
                {!row.outOfStock ? (
                  <span className="text-neutral-500">{t("In stock")}</span>
                ) : row.requestedLabel ? (
                  <span className="text-green-700 dark:text-green-400">
                    {t("More kits requested {0}", [row.requestedLabel])}{" "}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => startTransition(() => unmarkKitsRequested(row.studyId))}
                      className="text-xs text-neutral-500 hover:underline disabled:opacity-60"
                    >
                      {t("Undo")}</button>
                  </span>
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-red-600 dark:text-red-400">{t("No kits left — request more")}</span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => startTransition(() => markKitsRequested(row.studyId))}
                      className="rounded-md border border-orange-400 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-800 hover:bg-orange-100 disabled:opacity-60 dark:border-orange-600 dark:bg-orange-950 dark:text-orange-200"
                    >
                      {t("Mark as requested")}</button>
                  </span>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-4 text-center text-neutral-400">
                {t("No kits in inventory yet.")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
