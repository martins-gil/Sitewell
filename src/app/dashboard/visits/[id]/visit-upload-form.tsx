"use client";

import { useRef, useState, useTransition } from "react";
import { uploadDocument } from "../../documents/actions";
import { DocumentTypeField } from "../../documents/document-type-field";
import { useT } from "@/lib/i18n/client";

export function VisitUploadForm({ studyId, visitId }: { studyId: string; visitId: string }) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Bumped after each add so the type picker goes back to its default.
  const [formKey, setFormKey] = useState(0);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await uploadDocument(formData);
        formRef.current?.reset();
        setFormKey((k) => k + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Failed to add the document."));
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <input type="hidden" name="studyId" value={studyId} />
      <input type="hidden" name="visitId" value={visitId} />
      <div className="grid grid-cols-2 gap-3">
        <DocumentTypeField key={formKey} defaultType="OTHER" />
        <div>
          <label className="block text-xs font-medium">{t("Version")}</label>
          <input
            name="version"
            required
            defaultValue="v1.0"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">{t("Status")}</label>
          <select
            name="status"
            defaultValue="ACTIVE"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            <option value="ACTIVE">{t("Active")}</option>
            <option value="PENDING">{t("Pending")}</option>
            <option value="EXPIRED">{t("Expired")}</option>
            <option value="SUPERSEDED">{t("Superseded")}</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">{t("Title")}</label>
          <input
            name="title"
            required
            placeholder={t("e.g. Source note, lab report")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">{t("File (optional)")}</label>
          <input type="file" name="file" className="mt-1 w-full text-sm" />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t("Adding…") : t("Add to this visit")}
      </button>
    </form>
  );
}
