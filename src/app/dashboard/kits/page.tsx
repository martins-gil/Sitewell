import { getKits, getLinkableVisits, getStudiesWithTemplatesForKits } from "@/lib/queries";
import { formatDate, isWithinDays, isPast } from "@/lib/format";
import { KIT_EXPIRY_WARNING_DAYS } from "@/lib/kits";
import { AddKitForm } from "./add-kit-form";
import { KitsTable, type KitRow } from "./kits-table";

export default async function KitsInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ studyId?: string; showUsed?: string }>;
}) {
  const params = await searchParams;
  const showUsed = params.showUsed === "1";

  const [kits, studies, visitOptions] = await Promise.all([
    getKits({ studyId: params.studyId, showUsed }),
    getStudiesWithTemplatesForKits(),
    getLinkableVisits(),
  ]);

  // Dates and expiry states are worked out here, on the server, so the client
  // table renders the same text on both sides and never has to read the clock.
  const rows: KitRow[] = kits.map((kit) => ({
    id: kit.id,
    name: kit.name,
    studyId: kit.studyId,
    protocolId: kit.study.protocolId,
    visitTypeName: kit.visitScheduleTemplate?.name ?? null,
    visit: kit.visit
      ? {
          id: kit.visit.id,
          label: `${kit.visit.subject.subjectCode} · ${kit.visit.visitType} · ${formatDate(
            kit.visit.actualDate ?? kit.visit.targetDate,
          )}`,
          occurred: kit.visit.actualDate !== null,
        }
      : null,
    expiryLabel: formatDate(kit.expiryDate),
    expiryState: !kit.expiryDate
      ? "none"
      : isPast(kit.expiryDate)
        ? "expired"
        : isWithinDays(kit.expiryDate, KIT_EXPIRY_WARNING_DAYS)
          ? "soon"
          : "ok",
    orderedLabel: kit.orderedAt ? formatDate(kit.orderedAt) : null,
    usedLabel: kit.usedAt ? formatDate(kit.usedAt) : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kits Inventory</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {rows.length} kit{rows.length === 1 ? "" : "s"}
          {showUsed ? " (including used)" : ""}. Kits expiring within {KIT_EXPIRY_WARNING_DAYS / 7} weeks
          raise an orange alert and a reminder email every 3 days until marked as ordered.
        </p>
      </div>

      <AddKitForm studies={studies} visitOptions={visitOptions} />

      <form className="flex flex-wrap items-center gap-3" method="get">
        <select
          name="studyId"
          defaultValue={params.studyId ?? ""}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">All studies</option>
          {studies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.protocolId}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <input type="checkbox" name="showUsed" value="1" defaultChecked={showUsed} />
          Show used kits
        </label>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Filter
        </button>
      </form>

      <KitsTable kits={rows} visitOptions={visitOptions} />
    </div>
  );
}
