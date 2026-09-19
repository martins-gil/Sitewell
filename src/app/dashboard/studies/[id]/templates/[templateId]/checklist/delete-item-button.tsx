"use client";

import { useTransition } from "react";
import { useT } from "@/lib/i18n/client";

export function DeleteChecklistItemButton({
  studyId,
  templateId,
  itemId,
  onDelete,
}: {
  studyId: string;
  templateId: string;
  itemId: string;
  onDelete: (studyId: string, templateId: string, itemId: string) => Promise<void>;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => onDelete(studyId, templateId, itemId))}
      className="text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
    >
      {t("Remove")}</button>
  );
}
