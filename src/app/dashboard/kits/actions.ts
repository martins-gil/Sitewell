"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";

export async function addKit(formData: FormData) {
  const ctx = await requireTenantContext();

  const studyId = String(formData.get("studyId") ?? "");
  const visitScheduleTemplateId = String(formData.get("visitScheduleTemplateId") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const expiryDateRaw = String(formData.get("expiryDate") ?? "");
  const expiryDate = expiryDateRaw ? new Date(expiryDateRaw) : null;

  if (!studyId || !name) {
    throw new Error("Study and kit name are required.");
  }

  await withTenantContext(ctx, async (tx) => {
    const study = await tx.study.findUniqueOrThrow({ where: { id: studyId } });
    await tx.kit.create({
      data: {
        organizationId: study.organizationId,
        studyId,
        visitScheduleTemplateId,
        name,
        expiryDate,
      },
    });
  });

  revalidatePath("/dashboard/kits");
}

export async function deleteKit(kitId: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) => tx.kit.delete({ where: { id: kitId } }));
  revalidatePath("/dashboard/kits");
}
