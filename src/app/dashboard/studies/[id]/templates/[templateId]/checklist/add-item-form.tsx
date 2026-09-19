"use client";

import { useRef, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";

type LibraryTask = { id: string; label: string; detail: string | null };

const CUSTOM_VALUE = "__custom__";

export function AddChecklistItemForm({
  library,
  addItem,
}: {
  library: LibraryTask[];
  addItem: (formData: FormData) => Promise<void>;
}) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(CUSTOM_VALUE);
  const [label, setLabel] = useState("");
  const [detail, setDetail] = useState("");

  function handleSelect(taskId: string) {
    setSelected(taskId);
    if (taskId === CUSTOM_VALUE) {
      setLabel("");
      setDetail("");
      return;
    }
    const task = library.find((entry) => entry.id === taskId);
    setLabel(task?.label ?? "");
    setDetail(task?.detail ?? "");
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addItem(formData);
        formRef.current?.reset();
        setSelected(CUSTOM_VALUE);
        setLabel("");
        setDetail("");
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Failed to add."));
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <h2 className="text-sm font-medium text-neutral-500">{t("Add a checklist item")}</h2>

      {library.length > 0 && (
        <div>
          <label className="block text-xs font-medium">{t("Choose from existing tasks")}</label>
          <select
            value={selected}
            onChange={(e) => handleSelect(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            <option value={CUSTOM_VALUE}>{t("+ New task…")}</option>
            {library.map((task) => (
              <option key={task.id} value={task.id}>
                {task.label}
                {task.detail ? ` (${task.detail})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium">{t("Item")}</label>
        <input
          name="label"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("e.g. Colheita de sangue")}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>
      <div>
        <label className="block text-xs font-medium">{t("Detail (optional)")}</label>
        <input
          name="detail"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder={t("e.g. hematologia, BQ, IgEt")}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t("Adding…") : t("Add item")}
      </button>
    </form>
  );
}
