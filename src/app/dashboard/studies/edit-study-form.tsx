"use client";

import { useState, useTransition } from "react";
import { updateStudyCore } from "./actions";
import { useT } from "@/lib/i18n/client";
import { ColorField, DepartmentField } from "./study-fields";

export function EditStudyForm({
  studyId,
  study,
  departments,
}: {
  studyId: string;
  study: {
    protocolId: string;
    title: string;
    phase: string | null;
    sponsor: string | null;
    status: string;
    departmentId: string | null;
    color: string;
  };
  departments: { id: string; name: string }[];
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateStudyCore(studyId, formData);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Failed to save study details."));
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <h2 className="text-sm font-medium text-neutral-500">{t("Study details")}</h2>
      <p className="text-xs text-neutral-500">
        {t("Fix a typo or update status — this is the study's core identity, separate from the document header fields below.")}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium">{t("Protocol ID")}</label>
          <input
            name="protocolId"
            required
            defaultValue={study.protocolId}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Phase (optional)")}</label>
          <input
            name="phase"
            defaultValue={study.phase ?? ""}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">{t("Title")}</label>
          <input
            name="title"
            required
            defaultValue={study.title}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Sponsor (optional)")}</label>
          <input
            name="sponsor"
            defaultValue={study.sponsor ?? ""}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Status")}</label>
          <select
            name="status"
            defaultValue={study.status}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            <option value="active">{t("Active")}</option>
            <option value="paused">{t("Paused")}</option>
            <option value="closed">{t("Closed")}</option>
          </select>
        </div>
        <DepartmentField departments={departments} defaultId={study.departmentId} />
        <ColorField defaultColor={study.color} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-green-700 dark:text-green-400">{t("Saved.")}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t("Saving…") : t("Save")}
      </button>
    </form>
  );
}
