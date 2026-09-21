import {
  getKits,
  getKitStock,
  getLinkableVisits,
  getStudiesWithTemplatesForKits,
  KIT_LIST_FILTERS,
  type KitListFilter,
} from "@/lib/queries";
import { formatDate, isWithinDays, isPast } from "@/lib/format";
import { KIT_EXPIRY_WARNING_DAYS } from "@/lib/kits";
import { kitState } from "@/lib/kit-stock";
import { AddKitForm } from "./add-kit-form";
import { KitsTable, type KitRow } from "./kits-table";
import { KitStockTable, type StockRow } from "./kit-stock-table";
import { getT } from "@/lib/i18n/server";

export default async function KitsInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ studyId?: string; status?: string; showUsed?: string }>;
}) {
  const t = await getT();
  const params = await searchParams;
  // ?showUsed=1 is what older bookmarks carry.
  const status: KitListFilter = KIT_LIST_FILTERS.includes(params.status as KitListFilter)
    ? (params.status as KitListFilter)
    : params.showUsed === "1"
      ? "all"
      : "";

  const [kits, stock, studies, visitOptions] = await Promise.all([
    getKits({ studyId: params.studyId, status }),
    getKitStock(params.studyId),
    getStudiesWithTemplatesForKits(),
    getLinkableVisits(t.locale),
  ]);

  // Dates and states are worked out here, on the server, so the client
  // table renders the same text on both sides and never has to read the clock.
  const now = new Date();
  const rows: KitRow[] = kits.map((kit) => ({
    id: kit.id,
    name: kit.name,
    studyId: kit.studyId,
    protocolId: kit.study.protocolId,
    state: kitState(kit, now),
    visitTypeName: kit.visitScheduleTemplate?.name ?? null,
    visit: kit.visit
      ? {
          id: kit.visit.id,
          label: `${kit.visit.subject.subjectCode} · ${kit.visit.visitType} · ${formatDate(
            kit.visit.actualDate ?? kit.visit.targetDate, t.locale,
          )}`,
          occurred: kit.visit.actualDate !== null,
        }
      : null,
    shipmentAwb: kit.shipment?.awb ?? null,
    expiryLabel: formatDate(kit.expiryDate, t.locale),
    expiryState: !kit.expiryDate
      ? "none"
      : isPast(kit.expiryDate)
        ? "expired"
        : isWithinDays(kit.expiryDate, KIT_EXPIRY_WARNING_DAYS)
          ? "soon"
          : "ok",
    orderedLabel: kit.orderedAt ? formatDate(kit.orderedAt, t.locale) : null,
    usedLabel: kit.usedAt ? formatDate(kit.usedAt, t.locale) : null,
  }));

  const stockRows: StockRow[] = stock.map((s) => ({
    studyId: s.studyId,
    protocolId: s.protocolId,
    title: s.title,
    available: s.available,
    assigned: s.assigned,
    expired: s.expired,
    used: s.used,
    outOfStock: s.outOfStock,
    requestedLabel: s.requestedAt ? formatDate(s.requestedAt, t.locale) : null,
  }));

  const statusOptions: { value: KitListFilter; label: string }[] = [
    { value: "", label: t("In stock") },
    { value: "available", label: t("Available") },
    { value: "assigned", label: t("Assigned") },
    { value: "expired", label: t("Expired") },
    { value: "used", label: t("Used") },
    { value: "all", label: t("All (including used)") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Kits Inventory")}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t("{0} kit shown.|{0} kits shown.", [rows.length])}{" "}
          {t("A kit given to a patient's visit is locked and no longer counts as available; when none are left, an orange alert asks for more.")}{" "}
          {t("Kits expiring within {0} weeks raise an orange alert and a reminder email every 3 days until marked as ordered.", [KIT_EXPIRY_WARNING_DAYS / 7])}
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-3" method="get">
        <select
          name="studyId"
          defaultValue={params.studyId ?? ""}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">{t("All studies")}</option>
          {studies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.protocolId}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          aria-label={t("Status")}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {t("Filter")}</button>
      </form>

      <KitStockTable rows={stockRows} />

      <AddKitForm studies={studies} visitOptions={visitOptions} />

      <KitsTable kits={rows} visitOptions={visitOptions} />
    </div>
  );
}
