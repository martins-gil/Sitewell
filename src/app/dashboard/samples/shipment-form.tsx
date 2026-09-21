"use client";

import { useRef, useState, useTransition } from "react";
import { createShipment, updateShipment } from "./actions";
import { shipmentProblemText } from "./shipment-problems";
import { MAX_SAMPLES } from "@/lib/lab-shipments";
import type { ShipmentKitOption } from "@/lib/lab-samples";
import { useT } from "@/lib/i18n/client";

export type ShipmentInitial = {
  id: string;
  studyId: string;
  awb: string;
  /** yyyy-mm-dd */
  shipDate: string;
  ambientCount: number;
  refrigeratedCount: number;
  frozenCount: number;
  notes: string;
  kitIds: string[];
};

type StudyOption = { id: string; protocolId: string };

const input =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";

/** Adds a shipment, or (with `initial`) edits one. */
export function ShipmentForm({
  studies,
  kitOptions,
  today,
  defaultStudyId,
  initial,
  onDone,
}: {
  studies: StudyOption[];
  kitOptions: ShipmentKitOption[];
  today: string;
  defaultStudyId?: string;
  initial?: ShipmentInitial;
  onDone?: () => void;
}) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const firstStudy = defaultStudyId || studies[0]?.id || "";
  const [studyId, setStudyId] = useState(initial?.studyId ?? firstStudy);

  // The kits of the chosen study whose samples can go in: given to a patient's visit, and
  // not in another shipment (the ones of this shipment stay ticked).
  const offered = kitOptions.filter((k) => k.studyId === studyId && (k.shipmentId === null || k.shipmentId === initial?.id));

  // onSubmit rather than <form action>: React resets an action's form afterwards, which
  // would wipe what was typed whenever the answer is a problem to fix.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = initial ? await updateShipment(initial.id, formData) : await createShipment(formData);
        if (!result.ok) {
          setError(shipmentProblemText(t, result.problem, String(formData.get("awb") ?? "")));
          return;
        }
        if (initial) {
          onDone?.();
        } else {
          formRef.current?.reset();
          setStudyId(firstStudy);
        }
      } catch {
        setError(t("Failed to save the shipment."));
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={initial ? "space-y-3" : "space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"}
    >
      {!initial && <h2 className="text-sm font-medium text-neutral-500">{t("Add a shipment of samples")}</h2>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <label className="block text-xs font-medium">{t("Study")}</label>
          <select
            name="studyId"
            required
            value={studyId}
            onChange={(e) => setStudyId(e.target.value)}
            className={input}
          >
            {studies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.protocolId}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Airway bill (AWB)")}</label>
          <input
            name="awb"
            required
            maxLength={40}
            defaultValue={initial?.awb}
            placeholder={t("e.g. 176-12345675")}
            className={input}
          />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Date shipped")}</label>
          <input type="date" name="shipDate" required defaultValue={initial?.shipDate ?? today} className={input} />
        </div>
        <div className="hidden md:block" />
        {(
          [
            ["ambientCount", t("Ambient samples"), initial?.ambientCount],
            ["refrigeratedCount", t("Refrigerated samples"), initial?.refrigeratedCount],
            ["frozenCount", t("Frozen samples"), initial?.frozenCount],
          ] as const
        ).map(([name, label, value]) => (
          <div key={name}>
            <label className="block text-xs font-medium">{label}</label>
            <input
              type="number"
              name={name}
              min={0}
              max={MAX_SAMPLES}
              step={1}
              defaultValue={value ?? 0}
              className={input}
            />
          </div>
        ))}
      </div>

      <div>
        <div className="text-xs font-medium">{t("Kits these samples were collected with (optional)")}</div>
        {offered.length === 0 ? (
          <p className="mt-1 text-xs text-neutral-400">
            {t("No kits given to a patient's visit for this study yet, or all of them are already in a shipment.")}
          </p>
        ) : (
          <div
            key={studyId}
            className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2 dark:border-neutral-800"
          >
            {offered.map((k) => (
              <label key={k.id} className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  name="kitIds"
                  value={k.id}
                  defaultChecked={initial?.kitIds.includes(k.id)}
                  className="mt-0.5"
                />
                <span>{k.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium">{t("Notes (optional)")}</label>
        <input name="notes" maxLength={1000} defaultValue={initial?.notes} className={input} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !studyId}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? t("Saving…") : initial ? t("Save") : t("Add shipment")}
        </button>
        {initial && (
          <button type="button" onClick={onDone} className="text-xs text-neutral-500 hover:underline">
            {t("Cancel")}</button>
        )}
      </div>
    </form>
  );
}
