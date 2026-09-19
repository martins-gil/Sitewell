"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";

// Kits show up in the Kits Inventory page, the visit detail page, the
// Overview count, and the orange banner in the dashboard layout — refresh
// everything under /dashboard rather than tracking which of those a given
// change touches.
function refresh() {
  revalidatePath("/dashboard", "layout");
}

export async function addKit(formData: FormData) {
  const ctx = await requireTenantContext();

  const studyId = String(formData.get("studyId") ?? "");
  const visitScheduleTemplateId = String(formData.get("visitScheduleTemplateId") ?? "") || null;
  const visitId = String(formData.get("visitId") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const expiryDateRaw = String(formData.get("expiryDate") ?? "");
  const expiryDate = expiryDateRaw ? new Date(expiryDateRaw) : null;

  if (!studyId || !name) {
    throw new Error("Study and kit name are required.");
  }

  await withTenantContext(ctx, async (tx) => {
    const study = await tx.study.findUniqueOrThrow({ where: { id: studyId } });
    if (visitId) {
      const visit = await tx.visit.findUniqueOrThrow({ where: { id: visitId } });
      if (visit.studyId !== studyId) throw new Error("That visit belongs to a different study.");
    }
    await tx.kit.create({
      data: {
        organizationId: study.organizationId,
        studyId,
        visitScheduleTemplateId,
        visitId,
        name,
        expiryDate,
      },
    });
  });

  refresh();
}

export async function deleteKit(kitId: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) => tx.kit.delete({ where: { id: kitId } }));
  refresh();
}

/** Links a kit to one specific visit (or unlinks it, with visitId null) —
 * from either the Kits Inventory page or the visit's own page. The kit and
 * the visit have to belong to the same study. */
export async function assignKitToVisit(kitId: string, visitId: string | null) {
  const ctx = await requireTenantContext();

  await withTenantContext(ctx, async (tx) => {
    const kit = await tx.kit.findUniqueOrThrow({ where: { id: kitId } });
    if (visitId) {
      if (kit.usedAt) throw new Error("This kit was already used and removed from inventory.");
      const visit = await tx.visit.findUniqueOrThrow({ where: { id: visitId } });
      if (visit.studyId !== kit.studyId) throw new Error("That visit belongs to a different study.");
    }
    await tx.kit.update({ where: { id: kitId }, data: { visitId } });
  });

  refresh();
}

/** Acknowledges that a replacement was ordered — stops the orange banner and
 * the every-3-days email for this kit. */
export async function markKitOrdered(kitId: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) =>
    tx.kit.update({ where: { id: kitId }, data: { orderedAt: new Date() } }),
  );
  refresh();
}

export async function unmarkKitOrdered(kitId: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) =>
    tx.kit.update({ where: { id: kitId }, data: { orderedAt: null } }),
  );
  refresh();
}

/** Removes a kit from inventory once it's been used. Only allowed after the
 * kit's linked visit has actually happened (has an actual date) — checked
 * here, not just by hiding the button. */
export async function markKitUsed(kitId: string) {
  const ctx = await requireTenantContext();

  await withTenantContext(ctx, async (tx) => {
    const kit = await tx.kit.findUniqueOrThrow({
      where: { id: kitId },
      include: { visit: { select: { actualDate: true } } },
    });
    if (!kit.visit) throw new Error("Link this kit to a visit before marking it used.");
    if (!kit.visit.actualDate) throw new Error("That visit hasn't happened yet.");
    await tx.kit.update({ where: { id: kitId }, data: { usedAt: new Date() } });
  });

  refresh();
}

export async function unmarkKitUsed(kitId: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) => tx.kit.update({ where: { id: kitId }, data: { usedAt: null } }));
  refresh();
}
