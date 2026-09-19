"use client";

import { useState } from "react";
import { humanizeEnum } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

export const DOCUMENT_TYPES = ["PROTOCOL", "IB", "ICF", "DELEGATION_LOG", "TRAINING_RECORD", "OTHER"];

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";

/**
 * The document type picker. Choosing "Other" reveals a field for the type's own
 * name (e.g. "Lab certificate"), which is then shown instead of "Other".
 * Renders two grid cells (the picker and, for "Other", the name field), so
 * put it directly inside the form's grid.
 */
export function DocumentTypeField({ defaultType = "PROTOCOL" }: { defaultType?: string }) {
  const t = useT();
  const [type, setType] = useState(defaultType);

  return (
    <>
      <div>
        <label className="block text-xs font-medium">{t("Type")}</label>
        <select name="type" required value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
          {DOCUMENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(humanizeEnum(value))}
            </option>
          ))}
        </select>
      </div>
      {type === "OTHER" && (
        <div>
          <label className="block text-xs font-medium">{t("Name of this type (optional)")}</label>
          <input name="typeLabel" maxLength={80} placeholder={t("e.g. Lab certificate")} className={inputClass} />
        </div>
      )}
    </>
  );
}
