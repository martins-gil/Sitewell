import { createHash, randomBytes } from "node:crypto";
import { emailConfigured, sendEmail } from "@/lib/email";
import { checkNewPassword, hashPassword, type PasswordProblem } from "@/lib/password";
import { prismaAuth } from "@/lib/prisma-auth";

// "Forgot password?": a one-time link sent to the account's email address.
//
// Like signing in, this starts from an email address alone, before anyone's
// organization is known — so it goes through the owner-role client (prisma-auth.ts),
// the one allowed exception to "ordinary queries go through withTenantContext".
// The tokens table is unreachable for the normal app role (see its migration).
//
// What it guarantees:
//  * Only the SHA-256 of the token is stored; the token itself exists only in the email.
//  * A link works once and for one hour.
//  * Asking never reveals whether an address has an account: the caller answers the
//    same either way, and the email is sent after the answer.
//  * At most three links per account per hour, so the form can't be used to flood
//    someone's inbox.
//  * Choosing a new password lifts a sign-in lock and ends every other open link.

const TOKEN_TTL_MS = 60 * 60 * 1000;
const MAX_LINKS_PER_HOUR = 3;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function passwordResetAvailable(): boolean {
  return emailConfigured();
}

/**
 * Creates a reset link for the account with this email and emails it. Does nothing
 * (and says nothing) when there is no such account or it asked too recently.
 */
export async function sendPasswordResetLink(email: string, origin: string): Promise<void> {
  const user = await prismaAuth.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, name: true, email: true },
  });
  if (!user) return;

  const recent = await prismaAuth.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_LINKS_PER_HOUR) return;

  const token = randomBytes(32).toString("base64url");
  await prismaAuth.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  await sendEmail({
    to: [user.email],
    subject: "Reset your SiteWell-ct password",
    text: [
      `Hi ${user.name.split(/\s+/)[0]},`,
      "",
      "Someone asked to reset the password of your SiteWell-ct account. To choose a new password, open this link within the next hour:",
      "",
      `${origin}/reset-password?token=${token}`,
      "",
      "If you didn't ask for this, you can ignore this email — your password stays as it is.",
    ].join("\n"),
  });
}

/** Whether a link from an email is still good (real, unused, not expired). */
export async function isResetLinkValid(token: string): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const row = await prismaAuth.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  return Boolean(row && !row.usedAt && row.expiresAt > new Date());
}

export type ResetResult = { ok: true } | { ok: false; problem: "INVALID_LINK" | PasswordProblem };

/** Sets the new password for the account the link belongs to, if the link is still good. */
export async function completePasswordReset(token: string, newPassword: string): Promise<ResetResult> {
  if (!token || token.length > 200) return { ok: false, problem: "INVALID_LINK" };
  const row = await prismaAuth.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!row || row.usedAt || row.expiresAt <= new Date()) return { ok: false, problem: "INVALID_LINK" };

  const problem = checkNewPassword(newPassword, row.user.email);
  if (problem) return { ok: false, problem };

  const passwordHash = await hashPassword(newPassword);
  const used = await prismaAuth.$transaction(async (tx) => {
    // Claim the link first: two people using it at the same moment can't both win.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) return false;
    await tx.user.update({
      where: { id: row.user.id },
      data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false, failedLoginCount: 0, lockedUntil: null },
    });
    // Any other link still waiting in someone's inbox is now void.
    await tx.passwordResetToken.updateMany({ where: { userId: row.user.id, usedAt: null }, data: { usedAt: new Date() } });
    return true;
  });
  return used ? { ok: true } : { ok: false, problem: "INVALID_LINK" };
}
