"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { nursingSheetSchema, type NursingSheet } from "@/lib/nursing-sheet";

/** Saves the nursing record for a visit type, or removes it (null). The sheet
 * is validated here, not trusted from the editor. */
export async function saveNursingSheet(studyId: string, templateId: string, sheet: NursingSheet | null) {
  const ctx = await requireTenantContext();

  let validated: NursingSheet | null = null;
  if (sheet) {
    const parsed = nursingSheetSchema.safeParse(sheet);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "The nursing sheet isn't valid.");
    validated = parsed.data;
  }

  await withTenantContext(ctx, (tx) =>
    tx.visitScheduleTemplate.update({
      where: { id: templateId },
      data: { nursingSheet: validated ?? Prisma.DbNull },
    }),
  );

  revalidatePath(`/dashboard/studies/${studyId}/templates/${templateId}/nursing-sheet`);
  revalidatePath("/dashboard/visits/[id]", "page");
}
