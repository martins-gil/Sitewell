"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";

export async function toggleChecklistItem(visitId: string, resultId: string, verified: boolean) {
  const ctx = await requireTenantContext();

  await withTenantContext(ctx, (tx) =>
    tx.visitChecklistResult.update({ where: { id: resultId }, data: { verified } }),
  );

  revalidatePath(`/dashboard/visits/${visitId}`);
}

// Adds a procedure to just this visit — not the shared VisitScheduleTemplate
// checklist every other subject's visit of that type uses. See the schema
// comment on VisitChecklistResult for why (visits aren't static).
export async function addVisitChecklistItem(visitId: string, formData: FormData) {
  const ctx = await requireTenantContext();

  const label = String(formData.get("label") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim() || null;
  if (!label) throw new Error("Procedure name is required.");

  await withTenantContext(ctx, async (tx) => {
    const visit = await tx.visit.findUniqueOrThrow({
      where: { id: visitId },
      select: { organizationId: true },
    });
    const maxSortOrder = await tx.visitChecklistResult.aggregate({
      where: { visitId },
      _max: { sortOrder: true },
    });

    await tx.visitChecklistResult.create({
      data: {
        organizationId: visit.organizationId,
        visitId,
        templateItemId: null,
        label,
        detail,
        sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
      },
    });
  });

  revalidatePath(`/dashboard/visits/${visitId}`);
}

// Removes an item from just this visit's checklist. Soft-delete (not
// tx.visitChecklistResult.delete) so a template-derived item that's removed
// here isn't seen as "missing" by getVisitChecklist's lazy-creation pass and
// silently recreated the next time this visit's checklist is viewed.
export async function removeVisitChecklistItem(visitId: string, resultId: string) {
  const ctx = await requireTenantContext();

  await withTenantContext(ctx, (tx) =>
    tx.visitChecklistResult.update({ where: { id: resultId }, data: { removed: true } }),
  );

  revalidatePath(`/dashboard/visits/${visitId}`);
}
