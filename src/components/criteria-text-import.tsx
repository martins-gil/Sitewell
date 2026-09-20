"use client";

import { useState, useTransition } from "react";
import { readCriteriaText } from "@/app/dashboard/import-actions";
import { useT } from "@/lib/i18n/client";
import type { CriteriaDraft } from "@/lib/text-import";

/**
 * "Paste the criteria as text": a box to drop the protocol's eligibility text
 * into, and a button that turns it into separate Inclusion and Exclusion bullet
 * points (with AI when it's switched on, otherwise with built-in rules). The
 * result goes to `onRead` for the host to show and confirm — nothing is saved here.
 */
export function CriteriaTextImport({ onRead }: { onRead: (draft: CriteriaDraft, usedAi: boolean) => void }) {
  const t = useT();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleRead() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await readCriteriaText(text);
        if (!result.ok) {
          setMessage(
            result.problem === "EMPTY"
              ? t("Paste the criteria text first.")
              : result.problem === "TOO_LONG"
                ? t("That text is too long — paste it in parts.")
                : t("Please wait a moment and try again."),
          );
          return;
        }
        onRead(result.draft, result.usedAi);
        const found = result.draft.inclusion.length + result.draft.exclusion.length;
        setMessage(
          found === 0
            ? t("No criteria were found in that text. Check that it includes the inclusion / exclusion lists.")
            : result.usedAi
              ? t("Read with AI — please check the lists below before saving.")
              : result.note
                ? t("The AI reader wasn't available, so the built-in reader was used — please check the lists below.")
                : t("Read with the built-in reader — please check the lists below."),
        );
        if (found > 0) setText("");
      } catch {
        setMessage(t("Something went wrong. Please try again."));
      }
    });
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium">{t("Paste the inclusion and exclusion criteria")}</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        disabled={pending}
        placeholder={t("Paste the text from the protocol here — inclusion and exclusion criteria together or one after the other.")}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleRead}
          disabled={pending || !text.trim()}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? t("Reading…") : t("Turn into bullet points")}
        </button>
        {message && <span className="text-xs text-neutral-600 dark:text-neutral-400">{message}</span>}
      </div>
      <p className="text-xs text-neutral-400">{t("Only protocol text — never patient information.")}</p>
    </div>
  );
}
