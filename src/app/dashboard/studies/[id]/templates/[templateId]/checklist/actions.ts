"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";

export async function addChecklistTemplateItem(
  studyId: string,
  templateId: string,
  formData: FormData,
) {
  const ctx = await requireTenantContext();

  const label = String(formData.get("label") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim() || null;
  if (!label) throw new Error("Item text is required.");

  await withTenantContext(ctx, async (tx) => {
    const template = await tx.visitScheduleTemplate.findUniqueOrThrow({ where: { id: templateId } });
    const maxSortOrder = await tx.checklistTemplateItem.aggregate({
      where: { visitScheduleTemplateId: templateId },
      _max: { sortOrder: true },
    });

    await tx.checklistTemplateItem.create({
      data: {
        organizationId: template.organizationId,
        visitScheduleTemplateId: templateId,
        label,
        detail,
        sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
      },
    });

    // Grow the reusable task library with anything new so it shows up in
    // the dropdown next time — a no-op if this exact label already exists.
    await tx.checklistTaskLibrary.upsert({
      where: { organizationId_label: { organizationId: template.organizationId, label } },
      create: { organizationId: template.organizationId, label, detail },
      update: { detail },
    });
  });

  revalidatePath(`/dashboard/studies/${studyId}/templates/${templateId}/checklist`);
}

export async function deleteChecklistTemplateItem(
  studyId: string,
  templateId: string,
  itemId: string,
) {
  const ctx = await requireTenantContext();
  // VisitChecklistResult.templateItemId is ON DELETE SET NULL, not a
  // required FK — deleting this template item detaches any visit's
  // already-recorded checklist row for it (label/detail/verified state is
  // denormalized onto that row, so it survives as a plain visit-only item)
  // rather than force-deleting that visit's history.
  await withTenantContext(ctx, (tx) => tx.checklistTemplateItem.delete({ where: { id: itemId } }));
  revalidatePath(`/dashboard/studies/${studyId}/templates/${templateId}/checklist`);
}
