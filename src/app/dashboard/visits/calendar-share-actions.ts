"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";

// Turning the user's calendar link on, replacing it, or off. Each call only
// touches the caller's own user row. Making a new link bumps the version, which
// is what invalidates the previous one (see src/lib/calendar-feed.ts).

async function change(data: { enable: boolean; newVersion: boolean }): Promise<{ ok: boolean }> {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) return { ok: false };
  await withTenantContext(ctx, (tx) =>
    tx.user.update({
      where: { id: ctx.userId },
      data: {
        calendarFeedEnabled: data.enable,
        ...(data.newVersion ? { calendarFeedVersion: { increment: 1 } } : {}),
      },
    }),
  );
  revalidatePath("/dashboard/visits");
  return { ok: true };
}

/** Creates the link (or replaces the current one with a fresh one). */
export async function createCalendarLink() {
  return change({ enable: true, newVersion: true });
}

/** Stops the link working. */
export async function turnOffCalendarLink() {
  return change({ enable: false, newVersion: false });
}
