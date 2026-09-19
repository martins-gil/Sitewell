"use client";

import { useState, useTransition } from "react";
import { updateDocumentDetails } from "./actions";
import { useT } from "@/lib/i18n/client";

export function EditDocumentDetails({
  documentId,
  version,
  typeLabel,
  releaseDateInput,
  expiryDateInput,
}: {
  documentId: string;
  version: string;
  // The name of an "Other" document's type; null for every other type.
  typeLabel: string | null;
  releaseDateInput: string;
  expiryDateInput: string;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateDocumentDetails(documentId, formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Failed to save."));
      }
    });
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="text-xs hover:underline">
        {t("Edit")}</button>
    );
  }

  return (
    <form action={handleSave} className="flex flex-wrap items-end gap-2">
      {typeLabel !== null && (
        <div>
          <label className="block text-[10px] font-medium text-neutral-500">{t("Name of this type (optional)")}</label>
          <input
            name="typeLabel"
            maxLength={80}
            defaultValue={typeLabel}
            placeholder={t("e.g. Lab certificate")}
            className="w-40 rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
      )}
      <div>
        <label className="block text-[10px] font-medium text-neutral-500">{t("Version")}</label>
        <input
          name="version"
          required
          defaultValue={version}
          className="w-28 rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>
      <div>
        <label className="block text-[10px] font-medium text-neutral-500">{t("Release date")}</label>
        <input
          type="date"
          name="releaseDate"
          defaultValue={releaseDateInput}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>
      <div>
        <label className="block text-[10px] font-medium text-neutral-500">{t("Expiry date")}</label>
        <input
          type="date"
          name="expiryDate"
          defaultValue={expiryDateInput}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t("Saving…") : t("Save")}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-neutral-500 hover:underline">
        {t("Cancel")}</button>
      {error && <span className="w-full text-xs text-red-600">{error}</span>}
    </form>
  );
}
