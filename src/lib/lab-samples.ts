import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { formatDate } from "@/lib/format";

export type ShipmentFilters = { studyId?: string; from?: string; to?: string };

function dayStart(raw: string | undefined): Date | undefined {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const d = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Shipments, newest first — one study and/or a date range (both ends included). */
export async function getLabShipments(filters: ShipmentFilters = {}) {
  const ctx = await requireTenantContext();
  const from = dayStart(filters.from);
  const toStart = dayStart(filters.to);
  const to = toStart ? new Date(toStart.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined;
  return withTenantContext(ctx, (tx) =>
    tx.labShipment.findMany({
      where: {
        studyId: filters.studyId || undefined,
        shipDate: from || to ? { gte: from, lte: to } : undefined,
      },
      include: {
        study: { select: { protocolId: true } },
        // Kit use (used / still in inventory), the visit and the patient — shown on
        // each shipment's row so it's clear where every sample came from.
        kits: {
          select: {
            id: true,
            name: true,
            usedAt: true,
            visit: {
              select: {
                id: true,
                visitType: true,
                targetDate: true,
                actualDate: true,
                subject: { select: { id: true, subjectCode: true } },
              },
            },
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: [{ shipDate: "desc" }, { createdAt: "desc" }],
    }),
  );
}

/** Studies for the shipment forms and the filter. */
export async function getSampleStudies() {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.study.findMany({ orderBy: { protocolId: "asc" }, select: { id: true, protocolId: true, title: true } }),
  );
}

export type ShipmentKitOption = { id: string; studyId: string; shipmentId: string | null; label: string };

/**
 * The kits whose samples can go into a shipment: those given to a patient's visit (a kit
 * nobody used has no samples), whether or not they've been removed from inventory since.
 * Each one carries the shipment it's already in, so a form can offer the free ones and the
 * ones of the shipment being edited.
 */
export async function getShipmentKitOptions(locale: string): Promise<ShipmentKitOption[]> {
  const ctx = await requireTenantContext();
  const kits = await withTenantContext(ctx, (tx) =>
    tx.kit.findMany({
      where: { visitId: { not: null } },
      select: {
        id: true,
        name: true,
        studyId: true,
        shipmentId: true,
        visit: {
          select: { visitType: true, targetDate: true, actualDate: true, subject: { select: { subjectCode: true } } },
        },
      },
      orderBy: [{ visit: { targetDate: "desc" } }, { name: "asc" }],
    }),
  );
  return kits.map((k) => ({
    id: k.id,
    studyId: k.studyId,
    shipmentId: k.shipmentId,
    label: `${k.name} · ${k.visit?.subject.subjectCode ?? ""} · ${k.visit?.visitType ?? ""} · ${formatDate(
      k.visit?.actualDate ?? k.visit?.targetDate ?? null,
      locale,
    )}`,
  }));
}
