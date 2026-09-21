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
  type KitResult,
} from "./actions";
import { kitProblemText } from "./kit-problems";
import type { KitState } from "@/lib/kit-stock";
import { useT } from "@/lib/i18n/client";

export type KitRow = {
  id: string;
  name: string;
  studyId: string;
  protocolId: string;
  state: KitState;
  visitTypeName: string | null;
  visit: { id: string; label: string; occurred: boolean } | null;
  shipmentAwb: string | null;
  expiryLabel: string;
  expiryState: "expired" | "soon" | "ok" | "none";
  orderedLabel: string | null;
  usedLabel: string | null;
};

export type VisitOption = { id: string; studyId: string; label: string };

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

const STATE_STYLE: Record<KitState, string> = {
  AVAILABLE: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  ASSIGNED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  USED: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

function KitTableRow({ kit, visitOptions }: { kit: KitRow; visitOptions: VisitOption[] }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pickedVisitId, setPickedVisitId] = useState("");

  function run(fn: () => Promise<KitResult | void>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await fn();
        if (result && !result.ok) setError(kitProblemText(t, result.problem));
      } catch {
        setError(t("Something went wrong."));
      }
    });
  }

  const used = kit.state === "USED";
  const needsOrder = kit.state !== "ASSIGNED" && (kit.expiryState === "expired" || kit.expiryState === "soon");
  const stateLabel: Record<KitState, string> = {
    AVAILABLE: t("Available"),
    ASSIGNED: t("Assigned"),
    EXPIRED: t("Expired"),
    USED: t("Used"),
  };

  return (
    <tr className={used ? "opacity-60" : undefined}>
      <td className="px-4 py-2">
        {kit.name}
        {kit.shipmentAwb && <div className="text-xs text-neutral-500">{t("Sent in shipment {0}", [kit.shipmentAwb])}</div>}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{kit.protocolId}</td>
      <td className="whitespace-nowrap px-4 py-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLE[kit.state]}`}>
          {kit.state === "ASSIGNED" && <LockIcon />}
          {stateLabel[kit.state]}
        </span>
      </td>
      <td className="px-4 py-2 text-neutral-500">
        {kit.visit ? (
          <div className="space-y-0.5">
            <Link href={`/dashboard/visits/${kit.visit.id}`} className="text-neutral-800 hover:underline dark:text-neutral-200">
              {kit.visit.label}
            </Link>
            {!used &&
              (kit.visit.occurred ? (
                <div className="text-xs">{t("Locked — the visit has taken place")}</div>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(t("Release \"{0}\" from this visit? It becomes available again.", [kit.name]))) {
                      run(() => assignKitToVisit(kit.id, null));
                    }
                  }}
                  className="block text-xs hover:underline disabled:opacity-60"
                >
                  {t("Release from this visit")}</button>
              ))}
          </div>
        ) : (
          <div className="space-y-1">
            {kit.visitTypeName && <div className="text-xs">{t("Earmarked: {0}", [kit.visitTypeName])}</div>}
            {kit.state === "AVAILABLE" && (
              <div className="flex items-center gap-1">
                <select
                  value={pickedVisitId}
                  onChange={(e) => setPickedVisitId(e.target.value)}
                  className="max-w-[16rem] rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                >
                  <option value="">{t("Assign to a patient's visit…")}</option>
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
                  {t("Assign")}</button>
              </div>
            )}
          </div>
        )}
      </td>
      <td
        className={`whitespace-nowrap px-4 py-2 ${
          used || kit.state === "ASSIGNED"
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
            {t("Ordered {0}", [kit.orderedLabel])}{" "}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => unmarkKitOrdered(kit.id))}
              className="text-xs text-neutral-500 hover:underline disabled:opacity-60"
            >
              {t("Undo")}</button>
          </span>
        ) : needsOrder ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => markKitOrdered(kit.id))}
            className="rounded-md border border-orange-400 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-800 hover:bg-orange-100 disabled:opacity-60 dark:border-orange-600 dark:bg-orange-950 dark:text-orange-200"
          >
            {t("Mark as ordered")}</button>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-3">
          {used ? (
            <>
              <span className="text-xs text-neutral-500">{t("Used {0}", [kit.usedLabel ?? ""])}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => unmarkKitUsed(kit.id))}
                className="text-xs hover:underline disabled:opacity-60"
              >
                {t("Restore")}</button>
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
                  {t("Remove (used)")}</button>
              )}
              {kit.state !== "ASSIGNED" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(t("Delete \"{0}\" entirely? This can't be undone.", [kit.name]))) {
                      run(() => deleteKit(kit.id));
                    }
                  }}
                  className="text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
                >
                  {t("Delete")}</button>
              )}
            </>
          )}
        </div>
        {error && <p className="mt-1 whitespace-normal text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export function KitsTable({ kits, visitOptions }: { kits: KitRow[]; visitOptions: VisitOption[] }) {
  const t = useT();
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
        <thead className="bg-neutral-50 dark:bg-neutral-900">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Kit")}</th>
            <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Study")}</th>
            <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Status")}</th>
            <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Patient's visit")}</th>
            <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Expiry")}</th>
            <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Ordered")}</th>
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
              <td colSpan={7} className="px-4 py-4 text-center text-neutral-400">
                {t("No kits to show.")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
