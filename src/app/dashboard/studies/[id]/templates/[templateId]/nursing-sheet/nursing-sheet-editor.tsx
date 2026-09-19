"use client";

import { useState, useTransition } from "react";
import {
  NURSING_SHEET_PRESETS,
  defaultNursingSheet,
  type NursingSheet,
  type NursingSheetRow,
  type NursingSheetSection,
} from "@/lib/nursing-sheet";
import { saveNursingSheet } from "./actions";

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";
const smallButton = "text-xs text-neutral-500 hover:underline disabled:opacity-40 disabled:no-underline";

const EMPTY_SECTION: NursingSheetSection = {
  title: "",
  timepoint: "",
  columns: { result: true, time: true, observations: false },
  firstColumnHeader: "",
  includeKits: false,
  footnote: "",
  rows: [{ label: "", readings: 1, note: "" }],
};


function moved<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/**
 * Edits one visit type's standard nursing record. The whole definition lives in
 * state and is saved in one go (validated again on the server) — sections are
 * few and rows are short, so there's no per-field saving.
 */
export function NursingSheetEditor({
  studyId,
  templateId,
  visitName,
  initial,
}: {
  studyId: string;
  templateId: string;
  visitName: string;
  initial: NursingSheet | null;
}) {
  // Nothing customised yet: start from the standard sheet visits already use.
  const [sheet, setSheet] = useState<NursingSheet>(initial ?? defaultNursingSheet());
  const [exists, setExists] = useState(initial !== null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function edit(update: (s: NursingSheet) => NursingSheet) {
    setSheet(update);
    setDirty(true);
    setNotice(null);
  }

  function editSection(i: number, update: (s: NursingSheetSection) => NursingSheetSection) {
    edit((s) => ({ ...s, sections: s.sections.map((sec, j) => (j === i ? update(sec) : sec)) }));
  }

  function editRow(i: number, k: number, patch: Partial<NursingSheetRow>) {
    editSection(i, (sec) => ({ ...sec, rows: sec.rows.map((row, j) => (j === k ? { ...row, ...patch } : row)) }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveNursingSheet(studyId, templateId, sheet);
        setExists(true);
        setDirty(false);
        setNotice("Saved.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  function handleRemove() {
    if (!window.confirm(`Go back to the standard nursing sheet for ${visitName} visits? Your changes to this one are lost.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await saveNursingSheet(studyId, templateId, null);
        setSheet(defaultNursingSheet());
        setExists(false);
        setDirty(true);
        setNotice("Back to the standard sheet.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <span className="text-neutral-500">Start from</span>
        <select
          defaultValue=""
          onChange={(e) => {
            const preset = NURSING_SHEET_PRESETS.find((p) => p.id === e.target.value);
            if (preset) {
              setSheet(structuredClone(preset.sheet));
              setDirty(true);
              setNotice(null);
            }
            e.target.value = "";
          }}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">a template…</option>
          {NURSING_SHEET_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-400">Replaces what&apos;s below.</span>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <div>
          <label className="block text-xs font-medium">Visit box label</label>
          <input
            value={sheet.visitLabel}
            onChange={(e) => edit((s) => ({ ...s, visitLabel: e.target.value }))}
            placeholder="Week/Dia"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-neutral-400">Printed before the visit name, e.g. “Week/Dia: {visitName}”.</p>
        </div>
        <div>
          <label className="block text-xs font-medium">Second title line (optional)</label>
          <input
            value={sheet.subtitle}
            onChange={(e) => edit((s) => ({ ...s, subtitle: e.target.value }))}
            placeholder="e.g. OLE Y1 Q4W"
            className={inputClass}
          />
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sheet.signature}
            onChange={(e) => edit((s) => ({ ...s, signature: e.target.checked }))}
            className="h-4 w-4"
          />
          Signature and date line at the end
        </label>
      </div>

      {sheet.sections.map((section, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-500">Section {i + 1}</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className={smallButton}
                disabled={i === 0}
                onClick={() => edit((s) => ({ ...s, sections: moved(s.sections, i, i - 1) }))}
              >
                Move up
              </button>
              <button
                type="button"
                className={smallButton}
                disabled={i === sheet.sections.length - 1}
                onClick={() => edit((s) => ({ ...s, sections: moved(s.sections, i, i + 1) }))}
              >
                Move down
              </button>
              <button
                type="button"
                className="text-xs text-red-700 hover:underline disabled:opacity-40 dark:text-red-400"
                disabled={sheet.sections.length === 1}
                onClick={() => edit((s) => ({ ...s, sections: s.sections.filter((_, j) => j !== i) }))}
              >
                Remove section
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium">Title</label>
              <input
                value={section.title}
                onChange={(e) => editSection(i, (s) => ({ ...s, title: e.target.value }))}
                placeholder="e.g. Avaliação dos Sinais Vitais"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium">Timepoint band (optional)</label>
              <input
                value={section.timepoint}
                onChange={(e) => editSection(i, (s) => ({ ...s, timepoint: e.target.value }))}
                placeholder="e.g. Pré-dose"
                className={inputClass}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium">Top-left header cell (optional)</label>
              <input
                value={section.firstColumnHeader}
                onChange={(e) => editSection(i, (s) => ({ ...s, firstColumnHeader: e.target.value }))}
                placeholder="e.g. Parâmetro"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="text-xs font-medium">Columns</span>
            {(
              [
                ["result", "Result"],
                ["time", "Time (Hora)"],
                ["observations", "Observations"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={section.columns[key]}
                  onChange={(e) =>
                    editSection(i, (s) => ({ ...s, columns: { ...s.columns, [key]: e.target.checked } }))
                  }
                  className="h-4 w-4"
                />
                {label}
              </label>
            ))}
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={section.includeKits}
                onChange={(e) => editSection(i, (s) => ({ ...s, includeKits: e.target.checked }))}
                className="h-4 w-4"
              />
              Show the visit&apos;s kits in the header
            </label>
          </div>

          <div>
            <p className="text-xs font-medium">Rows</p>
            <ul className="mt-1 space-y-2">
              {section.rows.map((row, k) => (
                <li key={k} className="grid grid-cols-[1fr_5rem_1fr_auto] items-start gap-2">
                  <input
                    value={row.label}
                    onChange={(e) => editRow(i, k, { label: e.target.value })}
                    placeholder="Row name, e.g. Pulso (bpm)"
                    aria-label="Row name"
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={row.readings}
                    onChange={(e) => editRow(i, k, { readings: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
                    aria-label="Number of readings"
                    title="Number of readings (e.g. 3 for blood pressure)"
                    className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  <input
                    value={row.note}
                    onChange={(e) => editRow(i, k, { note: e.target.value })}
                    placeholder="Note beside it (optional)"
                    aria-label="Row note"
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  <span className="flex items-center gap-2 pt-1.5">
                    <button
                      type="button"
                      className={smallButton}
                      disabled={k === 0}
                      aria-label="Move row up"
                      onClick={() => editSection(i, (s) => ({ ...s, rows: moved(s.rows, k, k - 1) }))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={smallButton}
                      disabled={k === section.rows.length - 1}
                      aria-label="Move row down"
                      onClick={() => editSection(i, (s) => ({ ...s, rows: moved(s.rows, k, k + 1) }))}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-700 hover:underline disabled:opacity-40 dark:text-red-400"
                      disabled={section.rows.length === 1}
                      onClick={() => editSection(i, (s) => ({ ...s, rows: s.rows.filter((_, j) => j !== k) }))}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-neutral-400">The number is how many readings the row has (blood pressure taken 3 times = 3).</p>
            <button
              type="button"
              onClick={() =>
                editSection(i, (s) => ({ ...s, rows: [...s.rows, { label: "", readings: 1, note: "" }] }))
              }
              className="mt-2 text-sm text-neutral-600 hover:underline dark:text-neutral-400"
            >
              + Add a row
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium">Footnote under the table (optional)</label>
            <input
              value={section.footnote}
              onChange={(e) => editSection(i, (s) => ({ ...s, footnote: e.target.value }))}
              placeholder="e.g. (*) avaliar com pelo menos 1 minuto de intervalo"
              className={inputClass}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        disabled={sheet.sections.length >= 10}
        onClick={() => edit((s) => ({ ...s, sections: [...s.sections, structuredClone(EMPTY_SECTION)] }))}
        className="text-sm text-neutral-600 hover:underline disabled:opacity-40 dark:text-neutral-400"
      >
        + Add a section
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || (exists && !dirty)}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Saving…" : exists ? "Save changes" : `Use this sheet for ${visitName} visits`}
        </button>
        {exists && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={pending}
            className="text-sm text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
          >
            Go back to the standard sheet
          </button>
        )}
        {notice && <span className="text-sm text-green-700 dark:text-green-400">{notice}</span>}
        {exists && dirty && !notice && <span className="text-xs text-neutral-500">Unsaved changes</span>}
      </div>
    </div>
  );
}
