"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updateVisitDocumentDetails } from "../actions";

export type DocHeaderValues = {
  studyId: string;
  hasTemplate: boolean;
  piName: string | null;
  siteNumber: string | null;
  protocolId: string;
  hasProtocolDocument: boolean;
  protocolAwaitingSignature: boolean;
  protocolVersion: string | null;
  protocolReleaseLabel: string;
  protocolReleaseInput: string;
  checklistVersion: string | null;
  checklistFootnote: string | null;
  checklistColumn: "VERIFIED" | "DATETIME";
};

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";

/**
 * What's printed on this visit's checklist .docx, laid out like the document
 * itself. Each value is saved to where it really lives — PI name and site
 * number on the study, protocol version and release date on the study's
 * protocol document, the "(V3)" label and footnote on the visit type's
 * checklist — so editing here changes every visit that uses them.
 */
export function VisitDocHeader({ visitId, values }: { visitId: string; values: DocHeaderValues }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateVisitDocumentDetails(visitId, formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  const releaseLabel = values.protocolReleaseLabel === "—" ? null : values.protocolReleaseLabel;
  const rows: { label: string; value: string | null; required: boolean; source: string }[] = [
    { label: "PI name", value: values.piName, required: true, source: "study" },
    { label: "Site Nº", value: values.siteNumber, required: true, source: "study" },
    { label: "Protocol Nº", value: values.protocolId, required: true, source: "study" },
    { label: "Protocol version", value: values.protocolVersion, required: true, source: "protocol document" },
    { label: "Protocol release date", value: releaseLabel, required: true, source: "protocol document" },
    ...(values.hasTemplate
      ? [
          { label: "Checklist version", value: values.checklistVersion, required: false, source: "visit checklist" },
          {
            label: "Last column",
            value: values.checklistColumn === "DATETIME" ? "Date and time each was done" : "Verified (tick)",
            required: false,
            source: "visit checklist",
          },
          {
            label: "Footnote",
            value: values.checklistFootnote ? values.checklistFootnote.replace(/\s+/g, " ").slice(0, 90) : null,
            required: false,
            source: "visit checklist",
          },
        ]
      : []),
  ];
  const missing = rows.filter((r) => r.required && !r.value).length;

  if (!editing) {
    return (
      <div className="rounded-lg border border-neutral-200 p-5 text-sm dark:border-neutral-800">
        <dl className="grid grid-cols-[auto_1fr_auto] gap-x-4 gap-y-2">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="text-neutral-500">{r.label}</dt>
              <dd className={r.value ? undefined : r.required ? "text-orange-600 dark:text-orange-400" : "text-neutral-400"}>
                {r.value ?? (r.required ? "Not set" : "—")}
              </dd>
              <dd className="text-xs text-neutral-400">{r.source}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <button type="button" onClick={() => setEditing(true)} className="font-medium hover:underline">
            Edit document details
          </button>
          {missing > 0 && (
            <span className="text-orange-600 dark:text-orange-400">
              {missing} field{missing === 1 ? "" : "s"} blank on the .docx
            </span>
          )}
          {values.protocolAwaitingSignature && (
            <span className="text-neutral-500">Protocol document is awaiting signature.</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      action={handleSave}
      className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium">PI name</label>
          <input name="piName" defaultValue={values.piName ?? ""} placeholder="e.g. Dr. Elena Vasquez" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium">Site Nº</label>
          <input name="siteNumber" defaultValue={values.siteNumber ?? ""} placeholder="e.g. 00001" className={inputClass} />
        </div>

        {values.hasProtocolDocument ? (
          <>
            <div>
              <label className="block text-xs font-medium">Protocol version</label>
              <input
                name="protocolVersion"
                defaultValue={values.protocolVersion ?? ""}
                placeholder="e.g. Amendment 5"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium">Protocol release date</label>
              <input type="date" name="protocolReleaseDate" defaultValue={values.protocolReleaseInput} className={inputClass} />
            </div>
          </>
        ) : (
          <p className="col-span-2 text-xs text-neutral-500">
            The protocol version and release date come from the study&apos;s protocol document, and this study has
            none yet.{" "}
            <Link href={`/dashboard/documents?studyId=${values.studyId}`} className="underline">
              Add one in Documents →
            </Link>
          </p>
        )}

        {values.hasTemplate && (
          <>
            <div className="col-span-2">
              <label className="block text-xs font-medium">Checklist version (printed as “(V3)” after the heading)</label>
              <input name="checklistVersion" defaultValue={values.checklistVersion ?? ""} placeholder="e.g. V3" className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium">What the checklist records for each procedure</label>
              <select name="checklistColumn" defaultValue={values.checklistColumn} className={inputClass}>
                <option value="VERIFIED">Verified — a tick when it was done</option>
                <option value="DATETIME">Date and time — when each procedure was done</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium">Footnote under the table (optional)</label>
              <textarea
                name="checklistFootnote"
                rows={3}
                defaultValue={values.checklistFootnote ?? ""}
                placeholder="e.g. *hematologia, BQ, IgEt, amostra para imunogenicidade e PK ou outros biomarcadores exploratórios"
                className={inputClass}
              />
            </div>
          </>
        )}
      </div>
      <p className="text-xs text-neutral-500">
        These are saved on the study, its protocol document and this visit type&apos;s checklist, so they apply to
        every visit that uses them — not just this one.
      </p>
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
