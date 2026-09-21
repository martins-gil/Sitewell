"use client";

import { useState, useTransition } from "react";
import { addStudy } from "./actions";
import { useT } from "@/lib/i18n/client";
import { ColorField, DepartmentField } from "./study-fields";
import { studyProblemText } from "./study-problems";

export function AddStudyForm({
  departments,
  defaultColor,
}: {
  departments: { id: string; name: string }[];
  // The first palette colour no other study uses.
  defaultColor: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // onSubmit rather than <form action>: React resets an action's form afterwards, which
  // would wipe what was typed whenever the answer is a problem to fix.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await addStudy(formData);
        if (result.ok) setOpen(false);
        else setError(studyProblemText(t, result.problem, String(formData.get("protocolId") ?? "")));
      } catch {
        setError(t("Failed to add study."));
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        {t("+ Add study")}</button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-500">{t("Add a study")}</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          {t("Cancel")}</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium">{t("Protocol ID (study acronym)")}</label>
          <input
            name="protocolId"
            required
            placeholder={t("e.g. RCN-305")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Phase (optional)")}</label>
          <input
            name="phase"
            placeholder={t("e.g. Phase III")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">{t("Full title (optional)")}</label>
          <input
            name="title"
            placeholder={t("Leave empty to use the acronym")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Sponsor (optional)")}</label>
          <input
            name="sponsor"
            placeholder={t("e.g. Meridian Therapeutics")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Status")}</label>
          <select
            name="status"
            defaultValue="active"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            <option value="active">{t("Active")}</option>
            <option value="paused">{t("Paused")}</option>
            <option value="closed">{t("Closed")}</option>
          </select>
        </div>
        <DepartmentField departments={departments} defaultId={null} />
        <ColorField defaultColor={defaultColor} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t("Adding…") : t("Add study")}
      </button>
    </form>
  );
}
