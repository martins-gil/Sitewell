"use client";

import { useState, useTransition } from "react";
import { deleteShipment } from "./actions";
import { ShipmentForm, type ShipmentInitial } from "./shipment-form";
import type { ShipmentKitOption } from "@/lib/lab-samples";
import { useT } from "@/lib/i18n/client";

export type ShipmentRowData = ShipmentInitial & {
  protocolId: string;
  dateLabel: string;
  kits: string[];
};

type StudyOption = { id: string; protocolId: string };

function ShipmentTableRow({
  shipment,
  studies,
  kitOptions,
  today,
}: {
  shipment: ShipmentRowData;
  studies: StudyOption[];
  kitOptions: ShipmentKitOption[];
  today: string;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <tr>
        <td colSpan={9} className="px-4 py-3">
          <ShipmentForm
            studies={studies}
            kitOptions={kitOptions}
            today={today}
            initial={shipment}
            onDone={() => setEditing(false)}
          />
        </td>
      </tr>
    );
  }

  const total = shipment.ambientCount + shipment.refrigeratedCount + shipment.frozenCount;
  const number = "whitespace-nowrap px-4 py-2 text-right tabular-nums";

  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-2">{shipment.dateLabel}</td>
      <td className="whitespace-nowrap px-4 py-2">{shipment.awb}</td>
      <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{shipment.protocolId}</td>
      <td className={number}>{shipment.ambientCount}</td>
      <td className={number}>{shipment.refrigeratedCount}</td>
      <td className={number}>{shipment.frozenCount}</td>
      <td className={`${number} font-medium`}>{total}</td>
      <td className="px-4 py-2 text-xs text-neutral-500">
        {shipment.kits.length === 0 ? (
          <span className="text-neutral-400">—</span>
        ) : (
          <ul className="space-y-0.5">
            {shipment.kits.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        )}
        {shipment.notes && <div className="mt-1 italic">{shipment.notes}</div>}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => setEditing(true)}
            className="text-xs text-neutral-600 hover:underline disabled:opacity-60 dark:text-neutral-400"
          >
            {t("Edit")}</button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(t("Delete shipment {0}? This can't be undone.", [shipment.awb]))) return;
              setError(null);
              startTransition(async () => {
                try {
                  await deleteShipment(shipment.id);
                } catch {
                  setError(t("Failed to delete."));
                }
              });
            }}
            className="text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
          >
            {t("Delete")}</button>
        </div>
        {error && <p className="mt-1 whitespace-normal text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export function ShipmentsTable({
  shipments,
  studies,
  kitOptions,
  today,
}: {
  shipments: ShipmentRowData[];
  studies: StudyOption[];
  kitOptions: ShipmentKitOption[];
  today: string;
}) {
  const t = useT();
  const head = "px-4 py-2 font-medium text-neutral-500";
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
        <thead className="bg-neutral-50 dark:bg-neutral-900">
          <tr>
            <th className={`${head} text-left`}>{t("Date shipped")}</th>
            <th className={`${head} text-left`}>{t("AWB")}</th>
            <th className={`${head} text-left`}>{t("Study")}</th>
            <th className={`${head} text-right`}>{t("Ambient")}</th>
            <th className={`${head} text-right`}>{t("Refrigerated")}</th>
            <th className={`${head} text-right`}>{t("Frozen")}</th>
            <th className={`${head} text-right`}>{t("Total")}</th>
            <th className={`${head} text-left`}>{t("Kits")}</th>
            <th className={head}></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {shipments.map((s) => (
            <ShipmentTableRow key={s.id} shipment={s} studies={studies} kitOptions={kitOptions} today={today} />
          ))}
          {shipments.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-4 text-center text-neutral-400">
                {t("No shipments to show.")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
