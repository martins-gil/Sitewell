"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireTenantContext, withTenantContext, type TenantContext } from "@/lib/db-context";
import { normalizeAwb, parseSampleCount } from "@/lib/lab-shipments";
import { parseDateOnly } from "@/lib/visit-scheduling";

// What the shipment forms get back. A thrown error would reach the browser as a masked
// "Server Components render" message in production, so anything a person can fix is a
// code here and the form words it (translated) itself — see shipment-problems.ts.
export type ShipmentProblem =
  | "MISSING"
  | "BAD_AWB"
  | "BAD_DATE"
  | "BAD_COUNT"
  | "NO_SAMPLES"
  | "DUPLICATE_AWB"
  | "WRONG_STUDY"
  | "KIT_NOT_USED"
  | "KIT_TAKEN"
  | "MISSING_REASON";
export type ShipmentResult = { ok: true } | { ok: false; problem: ShipmentProblem };

type Parsed = {
  studyId: string;
  awb: string;
  shipDate: Date;
  ambientCount: number;
  refrigeratedCount: number;
  frozenCount: number;
  notes: string | null;
  kitIds: string[];
};

function parseForm(formData: FormData): Parsed | { problem: ShipmentProblem } {
  const studyId = String(formData.get("studyId") ?? "");
  const dateRaw = String(formData.get("shipDate") ?? "");
  if (!studyId || !String(formData.get("awb") ?? "").trim() || !dateRaw) return { problem: "MISSING" };

  const awb = normalizeAwb(String(formData.get("awb") ?? ""));
  if (!awb) return { problem: "BAD_AWB" };

  let shipDate: Date;
  try {
    shipDate = parseDateOnly(dateRaw);
  } catch {
    return { problem: "BAD_DATE" };
  }

  const ambientCount = parseSampleCount(formData.get("ambientCount"));
  const refrigeratedCount = parseSampleCount(formData.get("refrigeratedCount"));
  const frozenCount = parseSampleCount(formData.get("frozenCount"));
  if (ambientCount === null || refrigeratedCount === null || frozenCount === null) return { problem: "BAD_COUNT" };
  if (ambientCount + refrigeratedCount + frozenCount === 0) return { problem: "NO_SAMPLES" };

  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1000) || null;
  const kitIds = [...new Set(formData.getAll("kitIds").map(String).filter(Boolean))];
  return { studyId, awb, shipDate, ambientCount, refrigeratedCount, frozenCount, notes, kitIds };
}

/** Saves the kits ticked for a shipment: they must be of its study, given to a patient's
 * visit, and not already in another shipment; kits no longer ticked are let go. */
async function setShipmentKits(
  tx: Prisma.TransactionClient,
  shipmentId: string,
  studyId: string,
  kitIds: string[],
): Promise<ShipmentProblem | null> {
  if (kitIds.length > 0) {
    const kits = await tx.kit.findMany({
      where: { id: { in: kitIds } },
      select: { studyId: true, visitId: true, shipmentId: true },
    });
    if (kits.length !== kitIds.length) return "KIT_NOT_USED";
    if (kits.some((k) => k.studyId !== studyId)) return "WRONG_STUDY";
    if (kits.some((k) => !k.visitId)) return "KIT_NOT_USED";
    if (kits.some((k) => k.shipmentId && k.shipmentId !== shipmentId)) return "KIT_TAKEN";
  }
  await tx.kit.updateMany({ where: { shipmentId, id: { notIn: kitIds } }, data: { shipmentId: null } });
  if (kitIds.length > 0) await tx.kit.updateMany({ where: { id: { in: kitIds } }, data: { shipmentId } });
  return null;
}

function refresh() {
  revalidatePath("/dashboard/samples");
  // The kit list shows which shipment a kit's samples went in.
  revalidatePath("/dashboard/kits");
}

// Thrown from inside the save's transaction so that a refused kit undoes the whole save
// (the shipment itself included) rather than leaving it half done.
class KitRefused extends Error {
  constructor(public problem: ShipmentProblem) {
    super(problem);
  }
}

async function save(
  ctx: TenantContext,
  parsed: Parsed,
  shipmentId: string | null,
): Promise<ShipmentResult> {
  try {
    await withTenantContext(ctx, async (tx) => {
      const study = await tx.study.findUniqueOrThrow({ where: { id: parsed.studyId } });
      const data = {
        studyId: parsed.studyId,
        awb: parsed.awb,
        shipDate: parsed.shipDate,
        ambientCount: parsed.ambientCount,
        refrigeratedCount: parsed.refrigeratedCount,
        frozenCount: parsed.frozenCount,
        notes: parsed.notes,
      };
      const saved = shipmentId
        ? await tx.labShipment.update({ where: { id: shipmentId }, data })
        : await tx.labShipment.create({ data: { ...data, organizationId: study.organizationId } });
      const problem = await setShipmentKits(tx, saved.id, parsed.studyId, parsed.kitIds);
      if (problem) throw new KitRefused(problem);
    });
  } catch (e) {
    if (e instanceof KitRefused) return { ok: false, problem: e.problem };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, problem: "DUPLICATE_AWB" };
    }
    throw e;
  }
  refresh();
  return { ok: true };
}

export async function createShipment(formData: FormData): Promise<ShipmentResult> {
  const ctx = await requireTenantContext();
  const parsed = parseForm(formData);
  if ("problem" in parsed) return { ok: false, problem: parsed.problem };
  return save(ctx, parsed, null);
}

export async function updateShipment(shipmentId: string, formData: FormData): Promise<ShipmentResult> {
  const ctx = await requireTenantContext();
  const parsed = parseForm(formData);
  if ("problem" in parsed) return { ok: false, problem: parsed.problem };
  return save(ctx, parsed, shipmentId);
}

/** Deletes a shipment record; its kits stay in inventory, just no longer marked as sent. */
export async function deleteShipment(shipmentId: string): Promise<ShipmentResult> {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) => tx.labShipment.delete({ where: { id: shipmentId } }));
  refresh();
  return { ok: true };
}

/**
 * Records the afternoon confirmation ("were these samples shipped?") from inside the app —
 * the same fields the public Yes/No link in the confirmation e-mail writes
 * (src/app/samples-confirm/), for when nobody clicks it or the answer needs correcting.
 */
export async function setShipmentConfirmation(
  shipmentId: string,
  shipped: boolean,
  reason?: string,
): Promise<ShipmentResult> {
  const ctx = await requireTenantContext();
  const clean = shipped ? null : (reason ?? "").trim().slice(0, 1000) || null;
  if (!shipped && !clean) return { ok: false, problem: "MISSING_REASON" };

  await withTenantContext(ctx, (tx) =>
    tx.labShipment.update({
      where: { id: shipmentId },
      data: { confirmedShipped: shipped, confirmedAt: new Date(), notShippedReason: clean },
    }),
  );
  refresh();
  return { ok: true };
}
