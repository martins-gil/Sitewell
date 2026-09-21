"use client";

import { useRef, useState, useTransition } from "react";
import { uploadDocument } from "./actions";
import { DocumentTypeField } from "./document-type-field";
import { useT } from "@/lib/i18n/client";
import { studyLabel } from "@/lib/study-label";

export function UploadDocumentForm({
  studies,
}: {
  studies: { id: string; protocolId: string; title: string }[];
}) {
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
        const result = await uploadDocument(formData);
        if (!result.ok) {
          setError(result.message);
          return;
        }
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
      className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <h2 className="text-sm font-medium text-neutral-500">{t("Add a document")}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium">{t("Study")}</label>
          <select
            name="studyId"
            required
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            {studies.map((s) => (
              <option key={s.id} value={s.id}>
                {studyLabel(s.protocolId, s.title)}
              </option>
            ))}
          </select>
        </div>
        <DocumentTypeField key={formKey} />
        <div className="col-span-2">
          <label className="block text-xs font-medium">{t("Title")}</label>
          <input
            name="title"
            required
            placeholder={t("e.g. RCN-101 Protocol")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Version")}</label>
          <input
            name="version"
            required
            placeholder={t("v1.0")}
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
            <option value="ACTIVE">{t("Active — in force")}</option>
            <option value="PENDING">{t("Pending — awaiting sign-off")}</option>
            <option value="EXPIRED">{t("Expired")}</option>
            <option value="SUPERSEDED">{t("Superseded — replaced by a newer version")}</option>
          </select>
          <p className="mt-1 text-xs text-neutral-400">
            {t("You can change it later from the Status column. Adding an Active document supersedes the older Active one with the same study, type and title.")}</p>
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Release date (optional)")}</label>
          <input
            type="date"
            name="releaseDate"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <p className="mt-1 text-xs text-neutral-400">
            {t("For a protocol: the amendment's date — printed on the checklist documents.")}</p>
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Expiry date (optional)")}</label>
          <input
            type="date"
            name="expiryDate"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">{t("File (optional)")}</label>
          <input type="file" name="file" className="mt-1 w-full text-sm" />
          <p className="mt-1 text-xs text-neutral-400">
            {t("Leave it empty to just log the document — you can attach a file to it later.")}</p>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t("Adding…") : t("Add document")}
      </button>
    </form>
  );
}
