"use client";

import { useState, useTransition } from "react";
import { badgeColorClass } from "@/components/badge";
import { DOCUMENT_STATUS_CHOICES, type DocumentDisplayStatus } from "@/lib/document-status";
import { humanizeEnum } from "@/lib/format";
import { setDocumentStatus } from "./actions";
import { useT } from "@/lib/i18n/client";

/** The document's status, shown as a coloured pill that's also the control:
 * pick another status to change it. */
export function DocumentStatusControl({
  documentId,
  status,
}: {
  documentId: string;
  status: DocumentDisplayStatus;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // What the server rendered, until the user picks something else and it's
  // confirmed (or rejected, in which case we fall back to the server's value).
  const [chosen, setChosen] = useState<DocumentDisplayStatus | null>(null);
  const shown = chosen ?? status;

  function handleChange(next: DocumentDisplayStatus) {
    setError(null);
    setChosen(next);
    startTransition(async () => {
      try {
        await setDocumentStatus(documentId, next);
        setChosen(null);
      } catch (e) {
        setChosen(null);
        setError(e instanceof Error ? e.message : t("Couldn't change the status."));
      }
    });
  }

  return (
    <div>
      <select
        value={shown}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value as DocumentDisplayStatus)}
        aria-label={t("Document status")}
        className={`cursor-pointer rounded-full border-0 px-2 py-0.5 text-xs font-medium disabled:opacity-60 ${badgeColorClass(shown)}`}
      >
        {DOCUMENT_STATUS_CHOICES.map((s) => (
          <option key={s} value={s}>
            {t(humanizeEnum(s))}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 max-w-[16rem] whitespace-normal text-xs text-red-600">{error}</p>}
    </div>
  );
}
