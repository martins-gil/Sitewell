"use client";

import { useState, useTransition } from "react";
import { readChecklistText } from "@/app/dashboard/import-actions";
import { useT } from "@/lib/i18n/client";
import type { ChecklistDraftItem } from "@/lib/text-import";

/**
 * "Paste the procedures as text": drop the visit's procedure list into a box,
 * turn it into separate checklist lines (with AI when it's switched on,
 * otherwise with built-in rules), fix them, then confirm. `onSave` does the
 * actual saving, so the same component serves a visit type's checklist and a
 * single visit's.
 */
export function ChecklistTextImport({
  onSave,
  saveLabel,
  texts,
}: {
  onSave: (items: ChecklistDraftItem[]) => Promise<{ added: number }>;
  saveLabel: string;
  // Wording for a list that isn't a visit's procedures (a monitoring visit's points to verify).
  texts?: { open: string; heading: string; placeholder: string; added: (n: number) => string; none: string };
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [items, setItems] = useState<ChecklistDraftItem[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleRead() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await readChecklistText(text);
        if (!result.ok) {
          setError(
            result.problem === "EMPTY"
              ? t("Paste the procedures text first.")
              : result.problem === "TOO_LONG"
                ? t("That text is too long — paste it in parts.")
                : t("Please wait a moment and try again."),
          );
          return;
        }
        if (result.items.length === 0) {
          setError(texts?.none ?? t("No procedures were found in that text."));
          return;
        }
        setItems((current) => [...current, ...result.items]);
        setText("");
        setMessage(
          result.usedAi
            ? t("Read with AI — please check the lines below before adding.")
            : result.note
              ? t("The AI reader wasn't available, so the built-in reader was used — please check the lines below.")
              : t("Read with the built-in reader — please check the lines below."),
        );
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        const cleaned = items.map((i) => ({ label: i.label.trim(), detail: i.detail?.trim() || null })).filter((i) => i.label);
        const { added } = await onSave(cleaned);
        setItems([]);
        setMessage(texts ? texts.added(added) : t("{0} procedure added.|{0} procedures added.", [added]));
        setOpen(false);
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  function edit(index: number, patch: Partial<ChecklistDraftItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  if (!open) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
        >
          {texts?.open ?? t("Paste a list of procedures →")}
        </button>
        {message && <p className="text-xs text-green-700 dark:text-green-400">{message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="space-y-2">
        <label className="block text-xs font-medium">{texts?.heading ?? t("Paste the procedures for this visit")}</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          disabled={pending}
          placeholder={texts?.placeholder ?? t("Paste the visit's procedures here, one per line or as a list — for example from the protocol's schedule of assessments.")}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRead}
            disabled={pending || !text.trim()}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
          >
            {pending ? t("Reading…") : t("Turn into checklist lines")}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setItems([]);
              setText("");
              setError(null);
              setMessage(null);
            }}
            className="text-xs text-neutral-500 hover:underline"
          >
            {t("Cancel")}
          </button>
        </div>
        <p className="text-xs text-neutral-400">{t("Only protocol text — never patient information.")}</p>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          <ul className="space-y-1.5">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="w-5 pt-1.5 text-right text-xs text-neutral-400">{i + 1}.</span>
                <input
                  value={item.label}
                  onChange={(e) => edit(i, { label: e.target.value })}
                  disabled={pending}
                  aria-label={t("Procedure name")}
                  className="min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950"
                />
                <input
                  value={item.detail ?? ""}
                  onChange={(e) => edit(i, { detail: e.target.value })}
                  disabled={pending}
                  placeholder={t("Detail (optional)")}
                  aria-label={t("Detail (optional)")}
                  className="min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setItems((current) => current.filter((_, n) => n !== i))}
                  aria-label={t("Remove")}
                  className="px-1 pt-1 text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
                >
                  {t("×")}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
          >
            {pending ? t("Adding…") : saveLabel}
          </button>
        </div>
      )}

      {message && <p className="text-xs text-neutral-600 dark:text-neutral-400">{message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
