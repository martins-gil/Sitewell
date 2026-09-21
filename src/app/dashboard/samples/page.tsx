import { getLabShipments, getSampleStudies, getShipmentKitOptions } from "@/lib/lab-samples";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { ShipmentForm } from "./shipment-form";
import { ShipmentsTable, type ShipmentRowData } from "./shipments-table";

export default async function LabSamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ studyId?: string; from?: string; to?: string }>;
}) {
  const t = await getT();
  const params = await searchParams;

  const [shipments, studies, kitOptions] = await Promise.all([
    getLabShipments({ studyId: params.studyId, from: params.from, to: params.to }),
    getSampleStudies(),
    getShipmentKitOptions(t.locale),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const rows: ShipmentRowData[] = shipments.map((s) => ({
    id: s.id,
    studyId: s.studyId,
    protocolId: s.study.protocolId,
    awb: s.awb,
    shipDate: s.shipDate.toISOString().slice(0, 10),
    dateLabel: formatDate(s.shipDate, t.locale),
    ambientCount: s.ambientCount,
    refrigeratedCount: s.refrigeratedCount,
    frozenCount: s.frozenCount,
    notes: s.notes ?? "",
    kitIds: s.kits.map((k) => k.id),
    kits: s.kits.map((k) => `${k.name} · ${k.visit?.subject.subjectCode ?? ""} · ${k.visit?.visitType ?? ""}`),
  }));

  const totals = shipments.reduce(
    (sum, s) => ({
      ambient: sum.ambient + s.ambientCount,
      refrigerated: sum.refrigerated + s.refrigeratedCount,
      frozen: sum.frozen + s.frozenCount,
    }),
    { ambient: 0, refrigerated: 0, frozen: 0 },
  );

  const field =
    "rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";
  const stat = "rounded-lg border border-neutral-200 p-4 dark:border-neutral-800";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Lab samples")}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t("Shipments of the samples collected with the study kits: the airway bill (AWB), the date and how many samples went ambient, refrigerated and frozen.")}
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <select name="studyId" defaultValue={params.studyId ?? ""} aria-label={t("Study")} className={field}>
          <option value="">{t("All studies")}</option>
          {studies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.protocolId}
            </option>
          ))}
        </select>
        <label className="text-xs text-neutral-500">
          {t("From")}
          <input type="date" name="from" defaultValue={params.from ?? ""} className={`${field} ml-2`} />
        </label>
        <label className="text-xs text-neutral-500">
          {t("To")}
          <input type="date" name="to" defaultValue={params.to ?? ""} className={`${field} ml-2`} />
        </label>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {t("Filter")}</button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className={stat}>
          <div className="text-xs text-neutral-500">{t("Shipments")}</div>
          <div className="mt-1 text-2xl font-semibold">{shipments.length}</div>
        </div>
        <div className={stat}>
          <div className="text-xs text-neutral-500">{t("Ambient samples")}</div>
          <div className="mt-1 text-2xl font-semibold">{totals.ambient}</div>
        </div>
        <div className={stat}>
          <div className="text-xs text-neutral-500">{t("Refrigerated samples")}</div>
          <div className="mt-1 text-2xl font-semibold">{totals.refrigerated}</div>
        </div>
        <div className={stat}>
          <div className="text-xs text-neutral-500">{t("Frozen samples")}</div>
          <div className="mt-1 text-2xl font-semibold">{totals.frozen}</div>
        </div>
      </div>

      <ShipmentForm studies={studies} kitOptions={kitOptions} today={today} defaultStudyId={params.studyId} />

      <ShipmentsTable shipments={rows} studies={studies} kitOptions={kitOptions} today={today} />
    </div>
  );
}
