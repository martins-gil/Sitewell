"use client";

import { useState, useTransition } from "react";
import { CriteriaDraftEditor } from "@/components/criteria-draft-editor";
import { CriteriaTextImport } from "@/components/criteria-text-import";
import { useT } from "@/lib/i18n/client";
import type { CriteriaDraft } from "@/lib/text-import";
import {
  addIeCriteriaBulk,
  addIeCriterion,
  loadStudyCriteria,
  removeIeCriterion,
  setIeCriterionStatus,
} from "./actions";

type IeType = "I" | "E";
// met: true / false / null (not assessed yet — e.g. cloned from another patient).
// It's about the criterion AS WRITTEN: for an exclusion criterion, "met" (it
// applies) is the bad answer. Criteria saved before the I/E split have no type
// and count as inclusion.
type IeCriterion = { criterion: string; met: boolean | null; type?: IeType };

const OK = "text-green-700 dark:text-green-400";
const BAD = "text-red-700 dark:text-red-400";
const PENDING = "text-neutral-500";

const emptyDraft: CriteriaDraft = { inclusion: [], exclusion: [] };

export function IeCriteriaEditor({
  subjectId,
  initialCriteria,
  studyHasCriteria,
}: {
  subjectId: string;
  initialCriteria: IeCriterion[];
  studyHasCriteria: boolean;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const [newType, setNewType] = useState<IeType>("I");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [draft, setDraft] = useState<CriteriaDraft>(emptyDraft);

  function run(fn: () => Promise<void>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Something went wrong."));
      }
    });
  }

  function handleAdd(met: boolean | null) {
    if (!text.trim()) {
      setError(t("Enter the criterion text first."));
      return;
    }
    run(async () => {
      await addIeCriterion(subjectId, text, met, newType);
      setText("");
    });
  }

  function reportAdded(added: number) {
    setNotice(added === 0 ? t("Nothing new to add — they're already on the list.") : t("{0} criterion added.|{0} criteria added.", [added]));
  }

  const statusButton = (active: boolean) =>
    `rounded px-1.5 py-0.5 text-[11px] ${
      active
        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
        : "border border-neutral-300 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
    }`;

  // Keep each criterion's position in the full list: the actions address it by index.
  const indexed = initialCriteria.map((c, index) => ({ ...c, index, type: (c.type === "E" ? "E" : "I") as IeType }));
  const groups: { type: IeType; title: string; metLabel: string; notMetLabel: string }[] = [
    { type: "I", title: t("Inclusion criteria"), metLabel: t("Met"), notMetLabel: t("Not met") },
    { type: "E", title: t("Exclusion criteria"), metLabel: t("Applies"), notMetLabel: t("Doesn't apply") },
  ];

  const draftCount = draft.inclusion.filter((l) => l.trim()).length + draft.exclusion.filter((l) => l.trim()).length;

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const items = indexed.filter((c) => c.type === group.type);
        return (
          <div key={group.type}>
            <h3 className="mb-1.5 text-sm font-medium">
              {group.title} <span className="text-neutral-400">({items.length})</span>
            </h3>
            <ul className="space-y-1.5 text-sm">
              {items.map((c) => {
                // ✓ always means "fine for eligibility": for an exclusion criterion that is "doesn't apply".
                const eligible = group.type === "I" ? c.met === true : c.met === false;
                const ineligible = group.type === "I" ? c.met === false : c.met === true;
                return (
                  <li key={c.index} className="flex flex-wrap items-center justify-between gap-2">
                    <span className={eligible ? OK : ineligible ? BAD : PENDING}>
                      {eligible ? "✓" : ineligible ? "✗" : "○"} {c.criterion}
                    </span>
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => setIeCriterionStatus(subjectId, c.index, true))}
                        className={statusButton(c.met === true)}
                      >
                        {group.metLabel}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => setIeCriterionStatus(subjectId, c.index, false))}
                        className={statusButton(c.met === false)}
                      >
                        {group.notMetLabel}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => setIeCriterionStatus(subjectId, c.index, null))}
                        className={statusButton(c.met === null)}
                        title={t("Not assessed yet")}
                      >
                        ?
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => removeIeCriterion(subjectId, c.index))}
                        className="px-1 text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
                        aria-label={t("Remove {0}", [c.criterion])}
                      >
                        {t("×")}
                      </button>
                    </span>
                  </li>
                );
              })}
              {items.length === 0 && <li className="text-neutral-400">{t("No criteria recorded.")}</li>}
            </ul>
          </div>
        );
      })}

      <div className="space-y-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
        <div className="flex flex-wrap gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as IeType)}
            disabled={pending}
            aria-label={t("Inclusion or exclusion")}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            <option value="I">{t("Inclusion")}</option>
            <option value="E">{t("Exclusion")}</option>
          </select>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("e.g. No prior investigational treatment")}
            disabled={pending}
            className="min-w-[12rem] flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => handleAdd(newType === "I")}
            className="rounded-md bg-green-100 px-2 py-1 text-sm font-medium text-green-800 disabled:opacity-60 dark:bg-green-950 dark:text-green-300"
          >
            {newType === "I" ? t("+ Met") : t("+ Doesn't apply")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => handleAdd(newType !== "I")}
            className="rounded-md bg-red-100 px-2 py-1 text-sm font-medium text-red-800 disabled:opacity-60 dark:bg-red-950 dark:text-red-300"
          >
            {newType === "I" ? t("+ Not met") : t("+ Applies")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => handleAdd(null)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm text-neutral-600 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-400"
            title={t("Add without deciding yet")}
          >
            {t("+ Not assessed")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          {studyHasCriteria && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(async () => reportAdded((await loadStudyCriteria(subjectId)).added))}
              className="font-medium hover:underline disabled:opacity-60"
            >
              {t("Load the study's criteria")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setImporting((v) => !v)}
            className="text-neutral-600 hover:underline dark:text-neutral-400"
          >
            {importing ? t("Hide the paste box") : t("Paste criteria text →")}
          </button>
        </div>

        {importing && (
          <div className="space-y-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
            <CriteriaTextImport onRead={(read) => setDraft(read)} />
            {draftCount > 0 && (
              <>
                <CriteriaDraftEditor draft={draft} onChange={setDraft} disabled={pending} />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const items = [
                        ...draft.inclusion.map((criterion) => ({ criterion, type: "I" as const })),
                        ...draft.exclusion.map((criterion) => ({ criterion, type: "E" as const })),
                      ];
                      reportAdded((await addIeCriteriaBulk(subjectId, items)).added);
                      setDraft(emptyDraft);
                      setImporting(false);
                    })
                  }
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
                >
                  {t("Add these to this patient (not assessed)")}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {(initialCriteria.length > 0 || studyHasCriteria) && (
        <a
          href={`/api/subjects/${subjectId}/ie-docx`}
          className="inline-block text-sm font-medium text-neutral-700 hover:underline dark:text-neutral-300"
        >
          {t("Download I/E criteria (.docx)")}
        </a>
      )}

      {notice && <p className="text-xs text-green-700 dark:text-green-400">{notice}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
