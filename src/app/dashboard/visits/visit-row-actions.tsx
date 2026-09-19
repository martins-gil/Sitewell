"use client";

import { useState, useTransition } from "react";
import { markVisitCompleted, markVisitMissed, rescheduleVisit } from "./actions";
import { useT } from "@/lib/i18n/client";

export function VisitRowActions({ visitId, status }: { visitId: string; status: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState("");

  if (status === "COMPLETED") {
    return <span className="text-xs text-neutral-400">—</span>;
  }

  if (rescheduling) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button
          disabled={!newDate || pending}
          onClick={() => startTransition(() => rescheduleVisit(visitId, newDate))}
          className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {t("Save")}</button>
        <button
          onClick={() => setRescheduling(false)}
          className="text-xs text-neutral-500 hover:underline"
        >
          {t("Cancel")}</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <button
        disabled={pending}
        onClick={() => startTransition(() => markVisitCompleted(visitId))}
        className="text-green-700 hover:underline disabled:opacity-60 dark:text-green-400"
      >
        {t("Complete")}</button>
      <button
        disabled={pending}
        onClick={() => startTransition(() => markVisitMissed(visitId))}
        className="text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
      >
        {t("Missed")}</button>
      <button
        disabled={pending}
        onClick={() => setRescheduling(true)}
        className="text-neutral-500 hover:underline disabled:opacity-60"
      >
        {t("Reschedule")}</button>
    </div>
  );
}
