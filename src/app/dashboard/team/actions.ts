"use server";

import { revalidatePath } from "next/cache";
import { Prisma, UserRole } from "@prisma/client";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { hashPassword } from "@/lib/password";

// Platform Admin is a cross-org role, not something an org's own team page
// should be able to grant — only roles that make sense within one org.
const ASSIGNABLE_ROLES: UserRole[] = ["CRC", "PI", "ORG_ADMIN"];

function requireOrgAdmin(ctx: { role: string; isPlatformAdmin: boolean }) {
  if (ctx.role !== "ORG_ADMIN" && !ctx.isPlatformAdmin) {
    throw new Error("Only an org admin can manage the team.");
  }
}

export async function addTeamMember(formData: FormData) {
  const ctx = await requireTenantContext();
  requireOrgAdmin(ctx);
  if (!ctx.organizationId) throw new Error("No organization to add this user to.");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;

  if (!name || !email) throw new Error("Name and email are required.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  if (!ASSIGNABLE_ROLES.includes(role)) throw new Error("Invalid role.");

  const passwordHash = await hashPassword(password);

  try {
    await withTenantContext(ctx, (tx) =>
      tx.user.create({
        data: { organizationId: ctx.organizationId, email, name, role, passwordHash },
      }),
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A user with email "${email}" already exists.`);
    }
    throw e;
  }

  revalidatePath("/dashboard/team");
}

export async function updateTeamMember(userId: string, formData: FormData) {
  const ctx = await requireTenantContext();
  requireOrgAdmin(ctx);

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as UserRole;

  if (!name || !email) throw new Error("Name and email are required.");
  if (!ASSIGNABLE_ROLES.includes(role)) throw new Error("Invalid role.");

  try {
    await withTenantContext(ctx, (tx) =>
      tx.user.update({ where: { id: userId }, data: { name, email, role } }),
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A user with email "${email}" already exists.`);
    }
    throw e;
  }

  revalidatePath("/dashboard/team");
}

export async function deleteTeamMember(userId: string) {
  const ctx = await requireTenantContext();
  requireOrgAdmin(ctx);

  if (userId === ctx.userId) {
    throw new Error("You cannot delete your own account.");
  }

  await withTenantContext(ctx, async (tx) => {
    // StudyAssignment has no cascade, but it's just an assignment link — safe
    // to clear. Signed documents and feedback submissions are left alone
    // (their FKs have no cascade either) since deleting those would erase
    // part of the record they belong to; block instead.
    const [signedDocs, feedback] = await Promise.all([
      tx.document.count({ where: { signedById: userId } }),
      tx.feedbackSubmission.count({ where: { submittedById: userId } }),
    ]);
    if (signedDocs > 0 || feedback > 0) {
      throw new Error("This user has signed documents or submitted feedback and can't be deleted.");
    }
    await tx.studyAssignment.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  revalidatePath("/dashboard/team");
}
