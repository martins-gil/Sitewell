"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteShipment, setShipmentConfirmation } from "./actions";
import { shipmentProblemText } from "./shipment-problems";
import { ShipmentForm, type ShipmentInitial } from "./shipment-form";
import type { ShipmentKitOption } from "@/lib/lab-samples";
import { useT } from "@/lib/i18n/client";

export type ShipmentKitLine = {
  name: string;
  used: boolean;
  subjectId: string | null;
  subjectCode: string | null;
  visitId: string | null;
  visitType: string | null;
  visitDateLabel: string | null;
};

export type ShipmentRowData = ShipmentInitial & {
  protocolId: string;
  dateLabel: string;
  kits: ShipmentKitLine[];
  confirmedShipped: boolean | null;
  confirmedAtLabel: string | null;
  notShippedReason: string | null;
};

type StudyOption = { id: string; protocolId: string };

/** "Kit — Patient RCN-101-0009 · Screening · Sep 22, 2026" (used kits dimmed). */
function KitLine({ kit }: { kit: ShipmentKitLine }) {
  const t = useT();
  const detail = [kit.visitType, kit.visitDateLabel].filter(Boolean).join(" · ");
  return (
    <div className={kit.used ? "opacity-60" : undefined}>
      <span className="font-medium">{kit.name}</span>
      {kit.used && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-neutral-400">{t("used")}</span>}
      {kit.subjectId && (
        <>
          {" — "}
          <Link href={`/dashboard/subjects/${kit.subjectId}`} className="hover:underline">
            {kit.subjectCode}
          </Link>
          {kit.visitId && detail && (
            <>
              {" · "}
              <Link href={`/dashboard/visits/${kit.visitId}`} className="hover:underline">
                {detail}
              </Link>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** "Were these samples shipped?" — shows the answer, or lets staff record one by hand
 * (the same fields the public e-mail link writes; see src/app/samples-confirm/). */
function ConfirmationCell({ shipment }: { shipment: ShipmentRowData }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; problem?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) setDeclining(false);
      else setError(shipmentProblemText(t, (result.problem as Parameters<typeof shipmentProblemText>[1]) ?? "MISSING_REASON", shipment.awb));
    });
  }

  if (shipment.confirmedShipped === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        {t("Shipped {0}", [shipment.confirmedAtLabel ?? ""])}
      </span>
    );
  }
  if (shipment.confirmedShipped === false) {
    return (
      <div className="space-y-0.5 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {t("Not shipped")}
        </span>
        {shipment.notShippedReason && <p className="text-neutral-500">“{shipment.notShippedReason}”</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-neutral-400">{t("Awaiting confirmation")}</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setShipmentConfirmation(shipment.id, true))}
          className="text-emerald-700 hover:underline disabled:opacity-60 dark:text-emerald-400"
        >
          {t("Mark shipped")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setDeclining((v) => !v)}
          className="text-amber-700 hover:underline disabled:opacity-60 dark:text-amber-400"
        >
          {t("Mark not shipped")}
        </button>
      </div>
      {declining && (
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("Why weren't they shipped?")}
            className="w-40 rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setShipmentConfirmation(shipment.id, false, reason))}
            className="text-neutral-600 hover:underline disabled:opacity-60 dark:text-neutral-400"
          >
            {t("Save")}
          </button>
        </div>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}

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
        <td colSpan={10} className="px-4 py-3">
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
          <div className="space-y-1">
            {shipment.kits.map((k, i) => (
              <KitLine key={i} kit={k} />
            ))}
          </div>
        )}
        {shipment.notes && <div className="mt-1 italic">{shipment.notes}</div>}
      </td>
      <td className="px-4 py-2">
        <ConfirmationCell shipment={shipment} />
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
            <th className={`${head} text-left`}>{t("Shipped?")}</th>
            <th className={head}></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {shipments.map((s) => (
            <ShipmentTableRow key={s.id} shipment={s} studies={studies} kitOptions={kitOptions} today={today} />
          ))}
          {shipments.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-4 text-center text-neutral-400">
                {t("No shipments to show.")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
