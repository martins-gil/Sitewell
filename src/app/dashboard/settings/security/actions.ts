"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { checkNewPassword, hashPassword, verifyPassword, type PasswordProblem } from "@/lib/password";

// Results are returned, not thrown: an error thrown from a server action is
// masked in production, so the form couldn't show what was wrong.
export type ChangePasswordResult = { ok: true } | { ok: false; problem: PasswordProblem | "WRONG_CURRENT" | "SAME" };

/** A signed-in user changing their own password (needs the current one). */
export async function changePassword(current: string, next: string): Promise<ChangePasswordResult> {
  const ctx = await requireTenantContext();

  // The slow bcrypt work happens outside the database transaction.
  const user = await withTenantContext(ctx, (tx) =>
    tx.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { passwordHash: true, email: true } }),
  );

  if (!(await verifyPassword(current, user.passwordHash))) return { ok: false, problem: "WRONG_CURRENT" };
  const problem = checkNewPassword(next, user.email);
  if (problem) return { ok: false, problem };
  if (await verifyPassword(next, user.passwordHash)) return { ok: false, problem: "SAME" };

  const passwordHash = await hashPassword(next);
  await withTenantContext(ctx, (tx) =>
    tx.user.update({
      where: { id: ctx.userId },
      data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    }),
  );

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
