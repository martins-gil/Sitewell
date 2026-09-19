"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  assignKitToVisit,
  deleteKit,
  markKitOrdered,
  markKitUsed,
  unmarkKitOrdered,
  unmarkKitUsed,
} from "./actions";

export type KitRow = {
  id: string;
  name: string;
  studyId: string;
  protocolId: string;
  visitTypeName: string | null;
  visit: { id: string; label: string; occurred: boolean } | null;
  expiryLabel: string;
  expiryState: "expired" | "soon" | "ok" | "none";
  orderedLabel: string | null;
  usedLabel: string | null;
};

export type VisitOption = { id: string; studyId: string; label: string };

function KitTableRow({ kit, visitOptions }: { kit: KitRow; visitOptions: VisitOption[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickedVisitId, setPickedVisitId] = useState("");

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

  const used = kit.usedLabel !== null;
  const needsOrder = kit.expiryState === "expired" || kit.expiryState === "soon";

  return (
    <tr className={used ? "opacity-60" : undefined}>
      <td className="px-4 py-2">{kit.name}</td>
      <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{kit.protocolId}</td>
      <td className="px-4 py-2 text-neutral-500">
        {kit.visit ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/dashboard/visits/${kit.visit.id}`} className="text-neutral-800 hover:underline dark:text-neutral-200">
              {kit.visit.label}
            </Link>
            {!used && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => assignKitToVisit(kit.id, null))}
                className="text-xs hover:underline disabled:opacity-60"
              >
                Unlink
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {kit.visitTypeName && <div className="text-xs">Earmarked: {kit.visitTypeName}</div>}
            {!used && (
              <div className="flex items-center gap-1">
                <select
                  value={pickedVisitId}
                  onChange={(e) => setPickedVisitId(e.target.value)}
                  className="max-w-[16rem] rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                >
                  <option value="">Link to a visit…</option>
                  {visitOptions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={pending || !pickedVisitId}
                  onClick={() => run(() => assignKitToVisit(kit.id, pickedVisitId))}
                  className="text-xs hover:underline disabled:opacity-40"
                >
                  Link
                </button>
              </div>
            )}
          </div>
        )}
      </td>
      <td
        className={`whitespace-nowrap px-4 py-2 ${
          used
            ? "text-neutral-500"
            : kit.expiryState === "expired"
              ? "font-medium text-red-600 dark:text-red-400"
              : kit.expiryState === "soon"
                ? "font-medium text-orange-600 dark:text-orange-400"
                : "text-neutral-500"
        }`}
      >
        {kit.expiryLabel}
      </td>
      <td className="whitespace-nowrap px-4 py-2">
        {used ? (
          <span className="text-neutral-400">—</span>
        ) : kit.orderedLabel ? (
          <span className="text-green-700 dark:text-green-400">
            Ordered {kit.orderedLabel}{" "}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => unmarkKitOrdered(kit.id))}
              className="text-xs text-neutral-500 hover:underline disabled:opacity-60"
            >
              Undo
            </button>
          </span>
        ) : needsOrder ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => markKitOrdered(kit.id))}
            className="rounded-md border border-orange-400 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-800 hover:bg-orange-100 disabled:opacity-60 dark:border-orange-600 dark:bg-orange-950 dark:text-orange-200"
          >
            Mark as ordered
          </button>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-3">
          {used ? (
            <>
              <span className="text-xs text-neutral-500">Used {kit.usedLabel}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => unmarkKitUsed(kit.id))}
                className="text-xs hover:underline disabled:opacity-60"
              >
                Restore
              </button>
            </>
          ) : (
            <>
              {kit.visit?.occurred && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => markKitUsed(kit.id))}
                  className="text-xs font-medium text-neutral-800 hover:underline disabled:opacity-60 dark:text-neutral-200"
                >
                  Remove (used)
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Delete "${kit.name}" entirely? This can't be undone.`)) {
                    run(() => deleteKit(kit.id));
                  }
                }}
                className="text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
              >
                Delete
              </button>
            </>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export function KitsTable({ kits, visitOptions }: { kits: KitRow[]; visitOptions: VisitOption[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
        <thead className="bg-neutral-50 dark:bg-neutral-900">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-neutral-500">Kit</th>
            <th className="px-4 py-2 text-left font-medium text-neutral-500">Study</th>
            <th className="px-4 py-2 text-left font-medium text-neutral-500">Visit</th>
            <th className="px-4 py-2 text-left font-medium text-neutral-500">Expiry</th>
            <th className="px-4 py-2 text-left font-medium text-neutral-500">Ordered</th>
            <th className="px-4 py-2 text-left font-medium text-neutral-500"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {kits.map((kit) => (
            <KitTableRow
              key={kit.id}
              kit={kit}
              visitOptions={visitOptions.filter((v) => v.studyId === kit.studyId)}
            />
          ))}
          {kits.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-4 text-center text-neutral-400">
                No kits to show.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
