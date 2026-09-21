"use server";

import { revalidatePath } from "next/cache";
import { Prisma, UserRole } from "@prisma/client";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { checkNewPassword, hashPassword, type PasswordProblem } from "@/lib/password";
import { normalizePhone } from "@/lib/sms";

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
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  const smsAsked = formData.get("smsAsked") === "on";

  if (!name || !email) throw new Error("Name and email are required.");
  if (!ASSIGNABLE_ROLES.includes(role)) throw new Error("Invalid role.");
  if (phoneRaw && !phone) throw new Error("That doesn't look like a phone number — use the international format, e.g. +351 912 345 678.");
  if (smsAsked && !phone) throw new Error("Add a mobile number to send this person text messages.");
  if (checkNewPassword(password, email)) {
    throw new Error("The temporary password must be at least 12 characters and not contain the email address.");
  }

  const passwordHash = await hashPassword(password);

  try {
    await withTenantContext(ctx, (tx) =>
      tx.user.create({
        // A password an admin chose is temporary: the user is asked to replace it.
        data: {
          organizationId: ctx.organizationId,
          email,
          name,
          role,
          passwordHash,
          mustChangePassword: true,
          phone,
          // Texts only when the person asked for them (the admin says so here); they can change it in Settings.
          notifySms: smsAsked,
          smsConsentAt: smsAsked ? new Date() : null,
        },
      }),
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A user with email "${email}" already exists.`);
    }
    throw e;
  }

  revalidatePath("/dashboard/settings/team");
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

  revalidatePath("/dashboard/settings/team");
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

  revalidatePath("/dashboard/settings/team");
}

export type ResetPasswordResult = { ok: true } | { ok: false; problem: PasswordProblem | "SELF" };

// For a member who forgot their password or is locked out (there's no
// "forgot password" email yet): the admin sets a new temporary password, which
// also lifts a sign-in lock. The member is asked to change it after signing in.
export async function resetTeamMemberPassword(userId: string, temporaryPassword: string): Promise<ResetPasswordResult> {
  const ctx = await requireTenantContext();
  requireOrgAdmin(ctx);
  if (userId === ctx.userId) return { ok: false, problem: "SELF" };

  const member = await withTenantContext(ctx, (tx) =>
    tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } }),
  );
  const problem = checkNewPassword(temporaryPassword, member.email);
  if (problem) return { ok: false, problem };

  const passwordHash = await hashPassword(temporaryPassword);
  await withTenantContext(ctx, (tx) =>
    tx.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    }),
  );

  revalidatePath("/dashboard/settings/team");
  return { ok: true };
}