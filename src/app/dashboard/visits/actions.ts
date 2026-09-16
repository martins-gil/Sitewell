"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";

function refresh() {
  revalidatePath("/dashboard/visits");
  revalidatePath("/dashboard");
}

export async function markVisitCompleted(visitId: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) =>
    tx.visit.update({
      where: { id: visitId },
      data: { status: "COMPLETED", actualDate: new Date() },
    }),
  );
  refresh();
}

export async function markVisitMissed(visitId: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) =>
    tx.visit.update({ where: { id: visitId }, data: { status: "MISSED" } }),
  );
  refresh();
}

export async function rescheduleVisit(visitId: string, newTargetDate: string) {
  const ctx = await requireTenantContext();
  const targetDate = new Date(newTargetDate);
  if (Number.isNaN(targetDate.getTime())) {
    throw new Error("Invalid date");
  }

  await withTenantContext(ctx, async (tx) => {
    const visit = await tx.visit.findUniqueOrThrow({ where: { id: visitId } });
    const shiftDays =
      (targetDate.getTime() - visit.targetDate.getTime()) / (24 * 60 * 60 * 1000);
    const windowStart = new Date(visit.windowStart.getTime() + shiftDays * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(visit.windowEnd.getTime() + shiftDays * 24 * 60 * 60 * 1000);

    await tx.visit.update({
      where: { id: visitId },
      data: { status: "RESCHEDULED", targetDate, windowStart, windowEnd },
    });
  });
  refresh();
}
