"use client";

import { useTransition } from "react";

export function DeleteTemplateButton({
  studyId,
  templateId,
  onDelete,
}: {
  studyId: string;
  templateId: string;
  onDelete: (studyId: string, templateId: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => onDelete(studyId, templateId))}
      className="text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
    >
      Remove
    </button>
  );
}
