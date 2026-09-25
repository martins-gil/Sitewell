"use client";

import { useRef, useState, useTransition } from "react";
import { addPendingIssue } from "./actions";
import { studyLabel } from "@/lib/study-label";
import { useT } from "@/lib/i18n/client";

type Study = { id: string; protocolId: string; title: string };

/** Adds a pending issue: the text, and optionally the study it's about. */
export function AddIssueForm({ studies, defaultStudyId }: { studies: Study[]; defaultStudyId?: string }) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
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
        const result = await addPendingIssue(formData);
        if (result.ok) formRef.current?.reset();
        else setError(t("Describe the issue."));
      } catch {
        setError(t("Failed to add the issue."));
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-wrap items-start gap-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <div className="min-w-[16rem] flex-1">
        <label className="block text-xs font-medium">{t("Issue")}</label>
        <textarea
          name="text"
          required
          rows={2}
          maxLength={2000}
          placeholder={t("What needs to be sorted out?")}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>
      <div>
        <label className="block text-xs font-medium">{t("Study (optional)")}</label>
        <select
          name="studyId"
          defaultValue={defaultStudyId ?? ""}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">{t("Not study-specific")}</option>
          {studies.map((s) => (
            <option key={s.id} value={s.id}>
              {studyLabel(s.protocolId, s.title)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col items-start gap-1 self-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? t("Adding…") : t("+ Add issue")}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </form>
  );
}
