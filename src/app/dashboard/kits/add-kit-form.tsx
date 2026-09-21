"use client";

import { useRef, useState, useTransition } from "react";
import { addKit } from "./actions";
import { kitProblemText } from "./kit-problems";
import { MAX_KITS_PER_ADD } from "@/lib/kit-stock";
import { useT } from "@/lib/i18n/client";

type Study = { id: string; protocolId: string; templates: { id: string; name: string }[] };
type VisitOption = { id: string; studyId: string; label: string };

export function AddKitForm({ studies, visitOptions }: { studies: Study[]; visitOptions: VisitOption[] }) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [studyId, setStudyId] = useState(studies[0]?.id ?? "");

  const selectedStudy = studies.find((s) => s.id === studyId);

  // onSubmit rather than <form action>: React resets an action's form afterwards, which
  // would wipe what was typed whenever the answer is a problem to fix.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await addKit(formData);
        if (result.ok) {
          formRef.current?.reset();
          setStudyId(studies[0]?.id ?? "");
        } else {
          setError(kitProblemText(t, result.problem));
        }
      } catch {
        setError(t("Failed to add kit."));
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <h2 className="text-sm font-medium text-neutral-500">{t("Add a kit to inventory")}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium">{t("Study")}</label>
          <select
            name="studyId"
            required
            value={studyId}
            onChange={(e) => setStudyId(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            {studies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.protocolId}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Assigned visit (optional)")}</label>
          <select
            name="visitScheduleTemplateId"
            defaultValue=""
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            <option value="">{t("Not visit-specific")}</option>
            {selectedStudy?.templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">{t("Link to a specific patient visit (optional)")}</label>
          <select
            key={studyId}
            name="visitId"
            defaultValue=""
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            <option value="">{t("Not linked to a visit yet")}</option>
            {visitOptions
              .filter((v) => v.studyId === studyId)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium">{t("Kit name")}</label>
          <input
            name="name"
            required
            placeholder={t("e.g. Baseline blood draw kits, Lot #4521")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Expiry date")}</label>
          <input
            type="date"
            name="expiryDate"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Quantity")}</label>
          <input
            type="number"
            name="quantity"
            min={1}
            max={MAX_KITS_PER_ADD}
            defaultValue={1}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending || !studyId}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t("Adding…") : t("Add kit")}
      </button>
    </form>
  );
}
