"use client";

import { useState, useTransition } from "react";
import { CriteriaDraftEditor } from "@/components/criteria-draft-editor";
import { CriteriaTextImport } from "@/components/criteria-text-import";
import { useT } from "@/lib/i18n/client";
import type { CriteriaDraft } from "@/lib/text-import";
import { saveStudyCriteria } from "../actions";

const same = (a: CriteriaDraft, b: CriteriaDraft) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The protocol's eligibility criteria for the whole study, as separate
 * Inclusion and Exclusion lists. Paste the protocol text to fill them in, tidy
 * them, and save: new patients of the study start from this list, and any
 * patient can load it from their own page.
 */
export function StudyCriteriaCard({ studyId, initial }: { studyId: string; initial: CriteriaDraft }) {
  const t = useT();
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [importing, setImporting] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const dirty = !same(draft, saved);
  const count = saved.inclusion.length + saved.exclusion.length;

  function handleRead(read: CriteriaDraft) {
    // Add to what's there, without repeating a line that's already listed.
    const merge = (a: string[], b: string[]) => [...a, ...b.filter((line) => !a.some((x) => x.trim().toLowerCase() === line.toLowerCase()))];
    setDraft((current) => ({
      inclusion: merge(current.inclusion, read.inclusion),
      exclusion: merge(current.exclusion, read.exclusion),
    }));
    setMessage(null);
  }

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      try {
        const cleaned = {
          inclusion: draft.inclusion.map((l) => l.trim()).filter(Boolean),
          exclusion: draft.exclusion.map((l) => l.trim()).filter(Boolean),
        };
        const result = await saveStudyCriteria(studyId, cleaned);
        if (result.ok) {
          setDraft(cleaned);
          setSaved(cleaned);
          setImporting(false);
          setMessage(t("Saved."));
        } else {
          setMessage(t("Couldn't save — a line may be too long."));
        }
      } catch {
        setMessage(t("Something went wrong. Please try again."));
      }
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div>
        <h2 className="text-sm font-medium text-neutral-500">{t("Eligibility criteria (I/E)")}</h2>
        <p className="mt-1 text-xs text-neutral-500">
          {t("The protocol's inclusion and exclusion criteria. New patients of this study start from this list, each one “not assessed”, and any patient can load it from their own page.")}
        </p>
      </div>

      {importing && <CriteriaTextImport onRead={handleRead} />}

      <CriteriaDraftEditor draft={draft} onChange={setDraft} disabled={pending} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !dirty}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? t("Saving…") : t("Save criteria")}
        </button>
        <button
          type="button"
          onClick={() => setImporting((v) => !v)}
          className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
        >
          {importing ? t("Hide the paste box") : t("Paste from the protocol →")}
        </button>
        {message && <span className="text-sm text-green-700 dark:text-green-400">{message}</span>}
        {dirty && !message && <span className="text-xs text-neutral-500">{t("Unsaved changes")}</span>}
        {!dirty && !message && count > 0 && (
          <span className="text-xs text-neutral-500">
            {t("{0} criterion saved|{0} criteria saved", [count])}
          </span>
        )}
      </div>
    </div>
  );
}
