"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";

type Item = { label: string; detail: string | null };

function clean(items: Item[]): Item[] {
  const seen = new Set<string>();
  return items
    .map((i) => ({ label: i.label.trim().slice(0, 250), detail: i.detail?.trim().slice(0, 400) || null }))
    .filter((i) => {
      const key = i.label.toLowerCase();
      if (!i.label || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 200);
}

/** Adds several procedures to a visit type's checklist at once (from pasted
 * text), in the order given, after the ones already there. Like adding one at
 * a time, each also joins the reusable task library. */
export async function addChecklistTemplateItemsBulk(studyId: string, templateId: string, items: Item[]) {
  const ctx = await requireTenantContext();
  const list = clean(items);
  if (list.length === 0) return { added: 0 };

  await withTenantContext(ctx, async (tx) => {
    const template = await tx.visitScheduleTemplate.findUniqueOrThrow({ where: { id: templateId } });
    const max = await tx.checklistTemplateItem.aggregate({
      where: { visitScheduleTemplateId: templateId },
      _max: { sortOrder: true },
    });
    let sortOrder = (max._max.sortOrder ?? -1) + 1;

    for (const item of list) {
      await tx.checklistTemplateItem.create({
        data: {
          organizationId: template.organizationId,
          visitScheduleTemplateId: templateId,
          label: item.label,
          detail: item.detail,
          sortOrder: sortOrder++,
        },
      });
      await tx.checklistTaskLibrary.upsert({
        where: { organizationId_label: { organizationId: template.organizationId, label: item.label } },
        create: { organizationId: template.organizationId, label: item.label, detail: item.detail },
        update: { detail: item.detail },
      });
    }
  });

  revalidatePath(`/dashboard/studies/${studyId}/templates/${templateId}/checklist`);
  return { added: list.length };
}

/** Adds several procedures to ONE visit only (not its visit type), from pasted text. */
export async function addVisitChecklistItemsBulk(visitId: string, items: Item[]) {
  const ctx = await requireTenantContext();
  const list = clean(items);
  if (list.length === 0) return { added: 0 };

  await withTenantContext(ctx, async (tx) => {
    const visit = await tx.visit.findUniqueOrThrow({ where: { id: visitId }, select: { organizationId: true } });
    const max = await tx.visitChecklistResult.aggregate({ where: { visitId }, _max: { sortOrder: true } });
    let sortOrder = (max._max.sortOrder ?? -1) + 1;
    await tx.visitChecklistResult.createMany({
      data: list.map((item) => ({
        organizationId: visit.organizationId,
        visitId,
        templateItemId: null,
        label: item.label,
        detail: item.detail,
        sortOrder: sortOrder++,
      })),
    });
  });

  revalidatePath(`/dashboard/visits/${visitId}`);
  return { added: list.length };
}
