"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { markKitOrdered, markKitsRequested } from "./kits/actions";
import { useT } from "@/lib/i18n/client";

export type ExpiringKit = {
  id: string;
  name: string;
  protocolId: string;
  expiryLabel: string;
  daysLeft: number;
};

/** A study whose kits have all been assigned, used or have expired. */
export type OutOfStockStudy = { studyId: string; protocolId: string; assigned: number };

const DISMISSED_KEY = "kit-expiry-banner-dismissed-on";
const DISMISSED_EVENT = "kit-expiry-banner-dismissed";

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(DISMISSED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DISMISSED_EVENT, callback);
  };
}

function getDismissedToday() {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === todayKey();
  } catch {
    return false;
  }
}

/**
 * Orange bar across the top of the app while any kit is expiring within 4
 * weeks (or already expired) and hasn't been marked ordered, or while a study has
 * no kits left (all assigned, used or expired) and more haven't been marked as
 * requested. "Dismiss for today" hides it until tomorrow — so it comes back every
 * day — but only marking as ordered / requested actually clears it for good.
 */
export function KitExpiryBanner({ kits, outOfStock }: { kits: ExpiringKit[]; outOfStock: OutOfStockStudy[] }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [dismissedHere, setDismissedHere] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Storage can be unavailable (private mode, blocked site data) — the
  // server snapshot and any failure both mean "not dismissed", so the banner
  // errs on the side of showing.
  const dismissedToday = useSyncExternalStore(subscribe, getDismissedToday, () => false);

  if ((kits.length === 0 && outOfStock.length === 0) || dismissedToday || dismissedHere) return null;

  function dismiss() {
    setDismissedHere(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, todayKey());
      window.dispatchEvent(new Event(DISMISSED_EVENT));
    } catch {
      // Falls back to dismissedHere, which lasts until the next page load.
    }
  }

  function order(kitId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await markKitOrdered(kitId);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Couldn't mark that kit as ordered."));
      }
    });
  }

  function request(studyId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await markKitsRequested(studyId);
      } catch {
        setError(t("Couldn't mark that as requested."));
      }
    });
  }

  const buttonClass =
    "rounded-md border border-orange-500 bg-white px-2 py-0.5 text-xs font-medium text-orange-900 hover:bg-orange-50 disabled:opacity-60 dark:bg-orange-900 dark:text-orange-50 dark:hover:bg-orange-800";

  return (
    <div
      role="alert"
      className="border-b border-orange-300 bg-orange-100 px-6 py-3 text-sm text-orange-950 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          {outOfStock.length > 0 && (
            <div>
              <p className="font-semibold">{t("No kits left — request more:")}</p>
              <ul className="mt-1 space-y-1">
                {outOfStock.map((s) => (
                  <li key={s.studyId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      <span className="font-medium">{s.protocolId}</span> —{" "}
                      {t("every kit is assigned, used or expired ({0} assigned to patients)", [s.assigned])}
                    </span>
                    <button type="button" disabled={pending} onClick={() => request(s.studyId)} className={buttonClass}>
                      {t("Mark as requested")}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {kits.length > 0 && (
            <div>
              <p className="font-semibold">
                {t("{0} kit expiring within 4 weeks (or already expired) — order replacements:|{0} kits expiring within 4 weeks (or already expired) — order replacements:", [kits.length])}
              </p>
              <ul className="mt-1 space-y-1">
                {kits.map((kit) => (
                  <li key={kit.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      {kit.name} <span className="opacity-70">[{kit.protocolId}]</span> —{" "}
                      {kit.daysLeft < 0
                        ? t("expired {0}", [kit.expiryLabel])
                        : kit.daysLeft === 0
                          ? t("expires today ({0})", [kit.expiryLabel])
                          : t("expires in {0} day ({1})|expires in {0} days ({1})", [kit.daysLeft, kit.expiryLabel])}
                    </span>
                    <button type="button" disabled={pending} onClick={() => order(kit.id)} className={buttonClass}>
                      {t("Mark as ordered")}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <p className="text-red-700 dark:text-red-300">{error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <Link href="/dashboard/kits" className="font-medium underline">
            {t("Open Kits Inventory")}</Link>
          <button type="button" onClick={dismiss} className="hover:underline">
            {t("Dismiss for today")}</button>
        </div>
      </div>
    </div>
  );
}
