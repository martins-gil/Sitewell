"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { createMonitoringVisit } from "./actions";
import { studyLabel } from "@/lib/study-label";

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";

export type CopySource = { id: string; studyId: string; label: string; points: number };

/** "+ Add monitoring visit": study, date, time, room — and optionally the points of an earlier visit to start from. */
export function AddMonitoringForm({
  studies,
  sources,
}: {
  studies: { id: string; protocolId: string; title: string }[];
  sources: CopySource[];
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [studyId, setStudyId] = useState(studies[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sourcesForStudy = sources.filter((s) => s.studyId === studyId);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await createMonitoringVisit(formData);
        if (result.ok) router.push(`/dashboard/monitoring/${result.id}`);
        else setError(result.problem);
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        {t("+ Add monitoring visit")}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-500">{t("Add a monitoring visit")}</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          {t("Cancel")}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium">{t("Study")}</label>
          <select
            name="studyId"
            required
            value={studyId}
            onChange={(e) => setStudyId(e.target.value)}
            className={inputClass}
          >
            {studies.map((s) => (
              <option key={s.id} value={s.id}>
                {studyLabel(s.protocolId, s.title)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Date")}</label>
          <input type="date" name="visitDate" required className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Time (optional)")}</label>
          <input type="time" name="startTime" className={inputClass} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">{t("Room")}</label>
          <input name="room" placeholder={t("e.g. Meeting room 2")} className={inputClass} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">{t("Notes (optional)")}</label>
          <textarea name="notes" rows={2} className={inputClass} />
        </div>
        {sourcesForStudy.length > 0 && (
          <div className="col-span-2">
            <label className="block text-xs font-medium">{t("Start with the points of an earlier visit (optional)")}</label>
            <select name="copyFromId" defaultValue="" className={inputClass}>
              <option value="">{t("Start with an empty list")}</option>
              {sourcesForStudy.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} — {t("{0} point|{0} points", [s.points])}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending || studies.length === 0}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t("Adding…") : t("Add monitoring visit")}
      </button>
    </form>
  );
}
