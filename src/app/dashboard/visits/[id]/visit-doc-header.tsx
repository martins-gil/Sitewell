"use client";

import { useState, useTransition } from "react";
import { updateStudyDocumentDetails } from "@/app/dashboard/studies/[id]/templates/actions";

export type DocHeaderValues = {
  protocolTitle: string;
  protocolId: string;
  piName: string | null;
  siteNumber: string | null;
  protocolAmendment: string | null;
  protocolDateLabel: string;
  protocolDateInput: string;
};

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";

/**
 * The details printed at the top of this visit's checklist .docx — shown right
 * here so it's obvious what's on the document (and what's missing) without
 * leaving the visit. They're facts about the study, not this one visit, so
 * saving them updates the study and every visit's document.
 */
export function VisitDocHeader({ studyId, values }: { studyId: string; values: DocHeaderValues }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateStudyDocumentDetails(studyId, formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  const rows: [string, string | null][] = [
    ["PI name", values.piName],
    ["Site Nº", values.siteNumber],
    ["Protocol name", values.protocolTitle],
    ["Protocol Nº", values.protocolId],
    ["Protocol version", values.protocolAmendment],
    ["Protocol version date", values.protocolDateLabel === "—" ? null : values.protocolDateLabel],
  ];
  const missing = rows.filter(([, v]) => !v).length;

  if (!editing) {
    return (
      <div className="rounded-lg border border-neutral-200 p-5 text-sm dark:border-neutral-800">
        <dl className="grid grid-cols-2 gap-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-neutral-500">{label}</dt>
              <dd className={value ? undefined : "text-orange-600 dark:text-orange-400"}>
                {value ?? "Not set"}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex items-center gap-3 text-xs">
          <button type="button" onClick={() => setEditing(true)} className="font-medium hover:underline">
            Edit document details
          </button>
          {missing > 0 && (
            <span className="text-orange-600 dark:text-orange-400">
              {missing} field{missing === 1 ? "" : "s"} still blank on the .docx
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Protocol name and number are edited on the study itself (Studies → the study).
        </p>
      </div>
    );
  }

  return (
    <form
      action={handleSave}
      className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium">PI name</label>
          <input name="piName" defaultValue={values.piName ?? ""} placeholder="e.g. Dr. Elena Vasquez" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium">Site Nº</label>
          <input name="siteNumber" defaultValue={values.siteNumber ?? ""} placeholder="e.g. 00001" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium">Protocol version</label>
          <input
            name="protocolAmendment"
            defaultValue={values.protocolAmendment ?? ""}
            placeholder="e.g. Amendment 5"
            className={inputClass}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">Protocol version date</label>
          <input type="date" name="protocolDate" defaultValue={values.protocolDateInput} className={inputClass} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
