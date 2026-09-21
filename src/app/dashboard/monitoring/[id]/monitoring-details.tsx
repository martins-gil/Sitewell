"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { deleteMonitoringVisit, updateMonitoringVisit } from "../actions";

export type MonitoringDetailsValues = {
  studyId: string;
  protocolId: string;
  studyTitle: string;
  dateLabel: string;
  dateInput: string; // YYYY-MM-DD
  startTime: string; // "HH:mm" or ""
  room: string;
  notes: string;
};

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";

/** The monitoring visit's date, time, room and notes, with an edit form and a delete button. */
export function MonitoringDetails({ id, values }: { id: string; values: MonitoringDetailsValues }) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateMonitoringVisit(id, formData);
        if (result.ok) setEditing(false);
        else setError(result.problem);
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteMonitoringVisit(id);
        router.push("/dashboard/monitoring");
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  return (
    <div className="space-y-4">
      {editing ? (
        <form onSubmit={handleSave} className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium">{t("Date")}</label>
              <input type="date" name="visitDate" required defaultValue={values.dateInput} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium">{t("Time (optional)")}</label>
              <input type="time" name="startTime" defaultValue={values.startTime} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium">{t("Room")}</label>
              <input name="room" defaultValue={values.room} placeholder={t("e.g. Meeting room 2")} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium">{t("Notes (optional)")}</label>
              <textarea name="notes" rows={3} defaultValue={values.notes} className={inputClass} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
            >
              {pending ? t("Saving…") : t("Save")}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-neutral-500 hover:underline">
              {t("Cancel")}
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-lg border border-neutral-200 p-5 text-sm dark:border-neutral-800">
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="text-neutral-500">{t("Study")}</dt>
            <dd>
              <Link href={`/dashboard/studies/${values.studyId}`} className="hover:underline">
                {values.protocolId} — {values.studyTitle}
              </Link>
            </dd>
            <dt className="text-neutral-500">{t("Date")}</dt>
            <dd>{values.dateLabel}</dd>
            <dt className="text-neutral-500">{t("Time")}</dt>
            <dd>{values.startTime || "—"}</dd>
            <dt className="text-neutral-500">{t("Room")}</dt>
            <dd>{values.room || "—"}</dd>
            {values.notes && (
              <>
                <dt className="text-neutral-500">{t("Notes")}</dt>
                <dd className="whitespace-pre-wrap">{values.notes}</dd>
              </>
            )}
          </dl>
          <button type="button" onClick={() => setEditing(true)} className="mt-3 text-xs font-medium hover:underline">
            {t("Edit details")}
          </button>
        </div>
      )}

      <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>{t("Delete this monitoring visit and its points?")}</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="rounded-md bg-red-700 px-3 py-1 text-sm font-medium text-white disabled:opacity-60"
            >
              {t("Yes, delete")}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-neutral-500 hover:underline">
              {t("Cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-red-700 hover:underline dark:text-red-400"
          >
            {t("Delete this monitoring visit")}
          </button>
        )}
        {error && confirmDelete && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
