"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updateStudyPiAndSite } from "@/app/dashboard/studies/actions";
import { useT } from "@/lib/i18n/client";

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";

export function PiSiteForm({
  studyId,
  piName,
  siteNumber,
  protocol,
}: {
  studyId: string;
  piName: string | null;
  siteNumber: string | null;
  protocol: { version: string; releaseLabel: string; awaitingSignature: boolean } | null;
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
        await updateStudyPiAndSite(studyId, formData);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Failed to save."));
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <h2 className="text-sm font-medium text-neutral-500">{t("Printed on the checklist documents")}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium">{t("PI name")}</label>
          <input name="piName" defaultValue={piName ?? ""} placeholder={t("e.g. Dr. Elena Vasquez")} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Site Nº")}</label>
          <input name="siteNumber" defaultValue={siteNumber ?? ""} placeholder={t("e.g. 00001")} className={inputClass} />
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        {protocol ? (
          <>
            {t("Protocol version and release date come from this study's protocol document:")}{" "}
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              {protocol.version}
              {protocol.releaseLabel !== "—" ? t(", released {0}", [protocol.releaseLabel]) : t(", no release date set")}
            </span>
            {protocol.awaitingSignature && ` ${t("(awaiting signature)")}`}.{" "}
          </>
        ) : (
          <>{t("This study has no protocol document yet, so no version or release date is printed.")}</>
        )}
        <Link href={`/dashboard/documents?studyId=${studyId}`} className="underline">
          {t("Open Documents →")}</Link>
      </p>
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
