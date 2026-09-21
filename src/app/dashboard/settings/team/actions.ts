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

// What the team forms get back. A thrown error would reach the browser as a masked
// "Server Components render" message in production, so anything a person can fix is a
// code here and the form words it (translated) itself.
export type TeamProblem =
  | "MISSING"
  | "INVALID_ROLE"
  | "BAD_PHONE"
  | "SMS_NEEDS_PHONE"
  | "BAD_PASSWORD"
  | "EMAIL_TAKEN"
  | "SELF"
  | "HAS_RECORDS";
export type TeamResult = { ok: true } | { ok: false; problem: TeamProblem };

export async function addTeamMember(formData: FormData): Promise<TeamResult> {
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

  if (!name || !email) return { ok: false, problem: "MISSING" };
  if (!ASSIGNABLE_ROLES.includes(role)) return { ok: false, problem: "INVALID_ROLE" };
  if (phoneRaw && !phone) return { ok: false, problem: "BAD_PHONE" };
  if (smsAsked && !phone) return { ok: false, problem: "SMS_NEEDS_PHONE" };
  if (checkNewPassword(password, email)) return { ok: false, problem: "BAD_PASSWORD" };

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
      return { ok: false, problem: "EMAIL_TAKEN" };
    }
    throw e;
  }

  revalidatePath("/dashboard/settings/team");
  return { ok: true };
}

export async function updateTeamMember(userId: string, formData: FormData): Promise<TeamResult> {
  const ctx = await requireTenantContext();
  requireOrgAdmin(ctx);

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as UserRole;

  if (!name || !email) return { ok: false, problem: "MISSING" };
  if (!ASSIGNABLE_ROLES.includes(role)) return { ok: false, problem: "INVALID_ROLE" };

  try {
    await withTenantContext(ctx, (tx) =>
      tx.user.update({ where: { id: userId }, data: { name, email, role } }),
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, problem: "EMAIL_TAKEN" };
    }
    throw e;
  }

  revalidatePath("/dashboard/settings/team");
  return { ok: true };
}

export async function deleteTeamMember(userId: string): Promise<TeamResult> {
  const ctx = await requireTenantContext();
  requireOrgAdmin(ctx);

  if (userId === ctx.userId) return { ok: false, problem: "SELF" };

  try {
    const blocked = await withTenantContext(ctx, async (tx) => {
      // StudyAssignment has no cascade, but it's just an assignment link — safe
      // to clear. Signed documents and feedback submissions are left alone
      // (their FKs have no cascade either) since deleting those would erase
      // part of the record they belong to; block instead.
      const [signedDocs, feedback] = await Promise.all([
        tx.document.count({ where: { signedById: userId } }),
        tx.feedbackSubmission.count({ where: { submittedById: userId } }),
      ]);
      if (signedDocs > 0 || feedback > 0) return true;
      await tx.studyAssignment.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
      return false;
    });
    if (blocked) return { ok: false, problem: "HAS_RECORDS" };
  } catch (e) {
    // Some other record still points at this person (a foreign key with no cascade).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return { ok: false, problem: "HAS_RECORDS" };
    }
    throw e;
  }

  revalidatePath("/dashboard/settings/team");
  return { ok: true };
}

export type ResetPasswordResult = { ok: true } | { ok: false; problem: PasswordProblem | "SELF" };

// For a member who can't use "Forgot your password?" (no email service yet, a wrong
// address) or is locked out: the admin sets a new temporary password, which
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