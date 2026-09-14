import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export type TenantContext = {
  userId: string;
  organizationId: string | null;
  isPlatformAdmin: boolean;
  role: string;
};

/**
 * Every tenant-scoped query must go through here. It opens a transaction,
 * sets the Postgres session variables the RLS policies (prisma/rls_and_audit.sql)
 * check on every row, and only then runs the callback — so `tx` is
 * guaranteed to only see/affect rows in the caller's organization (or every
 * row, for a Platform Admin).
 */
export function withTenantContext<T>(
  ctx: TenantContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${ctx.organizationId ?? ""}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${ctx.userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.is_platform_admin', ${ctx.isPlatformAdmin ? "true" : "false"}, true)`;
    return fn(tx);
  });
}

/** Reads the current NextAuth session and throws if there isn't one. */
export async function requireTenantContext(): Promise<TenantContext> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("UNAUTHENTICATED");
  }
  return {
    userId: session.user.id,
    organizationId: session.user.organizationId,
    isPlatformAdmin: session.user.isPlatformAdmin,
    role: session.user.role,
  };
}
