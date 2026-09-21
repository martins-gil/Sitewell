"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { MAX_KITS_PER_ADD } from "@/lib/kit-stock";

// Kits show up in the Kits Inventory page, the visit detail page, the
// Overview count, and the orange banner in the dashboard layout — refresh
// everything under /dashboard rather than tracking which of those a given
// change touches.
function refresh() {
  revalidatePath("/dashboard", "layout");
}

// What the kit forms get back. A thrown error would reach the browser as a masked
// "Server Components render" message in production, so anything a person can fix is a
// code here and the screen words it (translated) itself — see kit-problems.ts.
export type KitProblem =
  | "MISSING"
  | "TOO_MANY"
  | "QUANTITY_WITH_VISIT"
  | "WRONG_STUDY"
  | "LOCKED"
  | "EXPIRED"
  | "USED"
  | "NOT_LINKED"
  | "NOT_HAPPENED"
  | "VISIT_HAPPENED";
export type KitResult = { ok: true } | { ok: false; problem: KitProblem };

const ok: KitResult = { ok: true };

/** Adds `quantity` identical kits (default one) to inventory. New stock also clears the
 * "kits requested" mark of the study, so the next time it runs out the alert returns. */
export async function addKit(formData: FormData): Promise<KitResult> {
  const ctx = await requireTenantContext();

  const studyId = String(formData.get("studyId") ?? "");
  const visitScheduleTemplateId = String(formData.get("visitScheduleTemplateId") ?? "") || null;
  const visitId = String(formData.get("visitId") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const expiryDateRaw = String(formData.get("expiryDate") ?? "");
  const expiryDate = expiryDateRaw ? new Date(expiryDateRaw) : null;
  const quantityRaw = String(formData.get("quantity") ?? "1").trim();
  const quantity = quantityRaw === "" ? 1 : Math.trunc(Number(quantityRaw));

  if (!studyId || !name || !Number.isFinite(quantity) || quantity < 1) return { ok: false, problem: "MISSING" };
  if (quantity > MAX_KITS_PER_ADD) return { ok: false, problem: "TOO_MANY" };
  if (quantity > 1 && visitId) return { ok: false, problem: "QUANTITY_WITH_VISIT" };

  const problem = await withTenantContext(ctx, async (tx): Promise<KitProblem | null> => {
    const study = await tx.study.findUniqueOrThrow({ where: { id: studyId } });
    if (visitId) {
      const visit = await tx.visit.findUniqueOrThrow({ where: { id: visitId } });
      if (visit.studyId !== studyId) return "WRONG_STUDY";
      if (expiryDate && expiryDate.getTime() < Date.now()) return "EXPIRED";
    }
    await tx.kit.createMany({
      data: Array.from({ length: quantity }, () => ({
        organizationId: study.organizationId,
        studyId,
        visitScheduleTemplateId,
        visitId,
        name,
        expiryDate,
      })),
    });
    await tx.study.update({ where: { id: studyId }, data: { kitRestockRequestedAt: null, lastKitStockEmailAt: null } });
    return null;
  });
  if (problem) return { ok: false, problem };

  refresh();
  return ok;
}

/** Deletes a kit from inventory. A kit given to a patient's visit is locked and can't be
 * deleted — release it from that visit first (only possible before the visit happens). */
export async function deleteKit(kitId: string): Promise<KitResult> {
  const ctx = await requireTenantContext();
  const problem = await withTenantContext(ctx, async (tx): Promise<KitProblem | null> => {
    const kit = await tx.kit.findUniqueOrThrow({ where: { id: kitId } });
    if (kit.visitId) return "LOCKED";
    await tx.kit.delete({ where: { id: kitId } });
    return null;
  });
  if (problem) return { ok: false, problem };
  refresh();
  return ok;
}

/**
 * Gives a kit to one specific patient visit (locking it: it no longer counts as
 * available), or releases it again with visitId null.
 *
 * Giving: the kit and the visit must belong to the same study, the kit must not have
 * expired or been used, and it must not already belong to another visit (release it
 * there first). Releasing: only until that visit has happened — after that the kit stays
 * with it (and can be removed from inventory as used).
 */
export async function assignKitToVisit(kitId: string, visitId: string | null): Promise<KitResult> {
  const ctx = await requireTenantContext();

  const problem = await withTenantContext(ctx, async (tx): Promise<KitProblem | null> => {
    const kit = await tx.kit.findUniqueOrThrow({
      where: { id: kitId },
      include: { visit: { select: { actualDate: true } } },
    });

    if (visitId) {
      if (kit.usedAt) return "USED";
      if (kit.visitId && kit.visitId !== visitId) return "LOCKED";
      if (kit.expiryDate && kit.expiryDate.getTime() < Date.now()) return "EXPIRED";
      const visit = await tx.visit.findUniqueOrThrow({ where: { id: visitId } });
      if (visit.studyId !== kit.studyId) return "WRONG_STUDY";
      await tx.kit.update({ where: { id: kitId }, data: { visitId } });
      return null;
    }

    if (!kit.visitId) return null;
    if (kit.usedAt || kit.visit?.actualDate) return "VISIT_HAPPENED";
    await tx.kit.update({ where: { id: kitId }, data: { visitId: null } });
    return null;
  });
  if (problem) return { ok: false, problem };

  refresh();
  return ok;
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

/** Acknowledges that more kits were requested for a study that ran out — stops the
 * "no kits left" banner and email until new kits are added and run out again. */
export async function markKitsRequested(studyId: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) =>
    tx.study.update({ where: { id: studyId }, data: { kitRestockRequestedAt: new Date() } }),
  );
  refresh();
}

export async function unmarkKitsRequested(studyId: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) =>
    tx.study.update({ where: { id: studyId }, data: { kitRestockRequestedAt: null, lastKitStockEmailAt: null } }),
  );
  refresh();
}

/** Removes a kit from inventory once it's been used. Only allowed after the
 * kit's linked visit has actually happened (has an actual date) — checked
 * here, not just by hiding the button. */
export async function markKitUsed(kitId: string): Promise<KitResult> {
  const ctx = await requireTenantContext();

  const problem = await withTenantContext(ctx, async (tx): Promise<KitProblem | null> => {
    const kit = await tx.kit.findUniqueOrThrow({
      where: { id: kitId },
      include: { visit: { select: { actualDate: true } } },
    });
    if (!kit.visit) return "NOT_LINKED";
    if (!kit.visit.actualDate) return "NOT_HAPPENED";
    await tx.kit.update({ where: { id: kitId }, data: { usedAt: new Date() } });
    return null;
  });
  if (problem) return { ok: false, problem };

  refresh();
  return ok;
}

export async function unmarkKitUsed(kitId: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) => tx.kit.update({ where: { id: kitId }, data: { usedAt: null } }));
  refresh();
}
