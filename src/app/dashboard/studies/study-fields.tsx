"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { STUDY_COLORS, studyColor } from "@/lib/study-colors";

const selectClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";

// Must match NEW_DEPARTMENT in ./actions.
const NEW_DEPARTMENT = "__new__";

/** Which department a study belongs to: pick one from the list, or add a new one. */
export function DepartmentField({
  departments,
  defaultId,
}: {
  departments: { id: string; name: string }[];
  defaultId: string | null;
}) {
  const t = useT();
  const [choice, setChoice] = useState(defaultId ?? "");

  return (
    <div>
      <label className="block text-xs font-medium">{t("Department (optional)")}</label>
      <select name="departmentId" value={choice} onChange={(e) => setChoice(e.target.value)} className={selectClass}>
        <option value="">{t("No department")}</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
        <option value={NEW_DEPARTMENT}>{t("+ New department…")}</option>
      </select>
      {choice === NEW_DEPARTMENT && (
        <input
          name="newDepartment"
          required
          autoFocus
          placeholder={t("e.g. Oncology")}
          aria-label={t("Name of the new department")}
          className={selectClass}
        />
      )}
    </div>
  );
}

/** The study's colour, picked from the palette (the calendar shows the study in it). */
export function ColorField({ defaultColor }: { defaultColor: string }) {
  const t = useT();
  const [color, setColor] = useState(defaultColor);

  return (
    <div>
      <span className="block text-xs font-medium">{t("Colour on the calendar")}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {STUDY_COLORS.map((c) => (
          <label key={c.id} title={t(c.label)} className="cursor-pointer">
            <input
              type="radio"
              name="color"
              value={c.id}
              checked={color === c.id}
              onChange={() => setColor(c.id)}
              className="peer sr-only"
              aria-label={t(c.label)}
            />
            <span
              className="block h-6 w-6 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-white peer-checked:ring-neutral-900 peer-focus-visible:ring-neutral-500 dark:ring-offset-neutral-950 dark:peer-checked:ring-white"
              style={{ backgroundColor: studyColor(c.id) }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
