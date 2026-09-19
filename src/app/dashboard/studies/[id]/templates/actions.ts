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

// The fields printed on the generated checklist .docx header (see
// src/lib/checklist-docx.ts) — set directly here rather than derived, since
// they're fixed facts about the protocol document, not whoever's logged in.
export async function updateStudyDocumentDetails(studyId: string, formData: FormData) {
  const ctx = await requireTenantContext();

  const piName = String(formData.get("piName") ?? "").trim() || null;
  const protocolAmendment = String(formData.get("protocolAmendment") ?? "").trim() || null;
  const protocolDateRaw = String(formData.get("protocolDate") ?? "");
  const protocolDate = protocolDateRaw ? new Date(protocolDateRaw) : null;
  const siteNumber = String(formData.get("siteNumber") ?? "").trim() || null;

  await withTenantContext(ctx, async (tx) => {
    const study = await tx.study.update({
      where: { id: studyId },
      data: { piName, protocolAmendment, protocolDate },
    });

    const existingSite = await tx.site.findFirst({
      where: { studyId },
      orderBy: { createdAt: "asc" },
    });

    if (existingSite) {
      await tx.site.update({ where: { id: existingSite.id }, data: { siteNumber } });
    } else if (siteNumber) {
      await tx.site.create({
        data: {
          organizationId: study.organizationId,
          studyId,
          name: `${study.protocolId} Site`,
          siteNumber,
        },
      });
    }
  });

  revalidatePath(`/dashboard/studies/${studyId}/templates`);
  // Also editable from each visit's page, where the same details are shown.
  revalidatePath("/dashboard/visits/[id]", "page");
}
