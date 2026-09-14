import { PrismaClient } from "@prisma/client";

/**
 * A second Prisma client connected via DIRECT_URL (the owner role, which
 * bypasses row-level security) instead of DATABASE_URL (the RLS-bound
 * app_runtime role used by every other query in the app — see db-context.ts).
 *
 * Login has to look a user up by email before we know their organization_id,
 * so it can't go through the normal tenant-scoped path. This client exists
 * ONLY for that bootstrap step (src/auth.ts's authorize callback and related
 * account provisioning) — never import it for ordinary business queries.
 */
const globalForPrismaAuth = globalThis as unknown as {
  prismaAuth: PrismaClient | undefined;
};

export const prismaAuth =
  globalForPrismaAuth.prismaAuth ??
  new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL } },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrismaAuth.prismaAuth = prismaAuth;
}
