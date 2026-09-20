"use client";

import { useT } from "@/lib/i18n/client";
import type { CriteriaDraft } from "@/lib/text-import";

type Group = "inclusion" | "exclusion";

/**
 * Inclusion and exclusion criteria side by side as editable bullet lists: fix
 * the wording, move one to the other list if it landed in the wrong one, remove
 * or add lines. Used to review pasted text before it's saved, and to edit the
 * study's saved list.
 */
export function CriteriaDraftEditor({
  draft,
  onChange,
  disabled,
}: {
  draft: CriteriaDraft;
  onChange: (next: CriteriaDraft) => void;
  disabled?: boolean;
}) {
  const t = useT();

  const other: Record<Group, Group> = { inclusion: "exclusion", exclusion: "inclusion" };

  function edit(group: Group, index: number, value: string) {
    onChange({ ...draft, [group]: draft[group].map((line, i) => (i === index ? value : line)) });
  }
  function remove(group: Group, index: number) {
    onChange({ ...draft, [group]: draft[group].filter((_, i) => i !== index) });
  }
  function move(group: Group, index: number) {
    const line = draft[group][index];
    onChange({
      ...draft,
      [group]: draft[group].filter((_, i) => i !== index),
      [other[group]]: [...draft[other[group]], line],
    });
  }
  function add(group: Group) {
    onChange({ ...draft, [group]: [...draft[group], ""] });
  }

  const columns: { group: Group; title: string; moveLabel: string }[] = [
    { group: "inclusion", title: t("Inclusion criteria"), moveLabel: t("Move to exclusion") },
    { group: "exclusion", title: t("Exclusion criteria"), moveLabel: t("Move to inclusion") },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {columns.map(({ group, title, moveLabel }) => (
        <div key={group} className="space-y-2">
          <h3 className="text-sm font-medium">
            {title} <span className="text-neutral-400">({draft[group].filter((l) => l.trim()).length})</span>
          </h3>
          <ul className="space-y-1.5">
            {draft[group].map((line, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span aria-hidden className="pt-1.5 text-neutral-400">
                  •
                </span>
                <textarea
                  value={line}
                  rows={Math.max(1, Math.ceil(line.length / 48))}
                  disabled={disabled}
                  onChange={(e) => edit(group, i, e.target.value)}
                  aria-label={title}
                  className="min-w-0 flex-1 resize-y rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => move(group, i)}
                  title={moveLabel}
                  aria-label={moveLabel}
                  className="px-1 pt-1 text-xs text-neutral-500 hover:underline disabled:opacity-60"
                >
                  ⇄
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => remove(group, i)}
                  aria-label={t("Remove")}
                  className="px-1 pt-1 text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
                >
                  {t("×")}
                </button>
              </li>
            ))}
            {draft[group].length === 0 && <li className="text-sm text-neutral-400">{t("None yet.")}</li>}
          </ul>
          <button
            type="button"
            disabled={disabled}
            onClick={() => add(group)}
            className="text-sm text-neutral-600 hover:underline disabled:opacity-60 dark:text-neutral-400"
          >
            {t("+ Add a line")}
          </button>
        </div>
      ))}
    </div>
  );
}
