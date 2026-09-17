"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";

export async function toggleChecklistItem(visitId: string, templateItemId: string, verified: boolean) {
  const ctx = await requireTenantContext();

  await withTenantContext(ctx, (tx) =>
    tx.visitChecklistResult.update({
      where: { visitId_templateItemId: { visitId, templateItemId } },
      data: { verified },
    }),
  );

  revalidatePath(`/dashboard/visits/${visitId}`);
}
