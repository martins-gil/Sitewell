"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";

export async function addVisitTemplate(studyId: string, formData: FormData) {
  const ctx = await requireTenantContext();

  const name = String(formData.get("name") ?? "").trim();
  const targetDayOffset = Number(formData.get("targetDayOffset"));
  const windowBeforeDays = Number(formData.get("windowBeforeDays") ?? 0);
  const windowAfterDays = Number(formData.get("windowAfterDays") ?? 0);

  if (!name || Number.isNaN(targetDayOffset)) {
    throw new Error("Name and target day offset are required.");
  }

  await withTenantContext(ctx, async (tx) => {
    const study = await tx.study.findUniqueOrThrow({ where: { id: studyId } });
    const maxSortOrder = await tx.visitScheduleTemplate.aggregate({
      where: { studyId },
      _max: { sortOrder: true },
    });

    await tx.visitScheduleTemplate.create({
      data: {
        organizationId: study.organizationId,
        studyId,
        name,
        targetDayOffset,
        windowBeforeDays: Number.isNaN(windowBeforeDays) ? 0 : windowBeforeDays,
        windowAfterDays: Number.isNaN(windowAfterDays) ? 0 : windowAfterDays,
        sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
      },
    });
  });

  revalidatePath(`/dashboard/studies/${studyId}/templates`);
}

export async function deleteVisitTemplate(studyId: string, templateId: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) => tx.visitScheduleTemplate.delete({ where: { id: templateId } }));
  revalidatePath(`/dashboard/studies/${studyId}/templates`);
}
