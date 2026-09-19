import { withTenantContext, type TenantContext } from "@/lib/db-context";
import { sendEmail } from "@/lib/email";
import { KIT_EXPIRY_WARNING_DAYS, KIT_EMAIL_INTERVAL_DAYS } from "@/lib/kits";

const DAY_MS = 24 * 60 * 60 * 1000;

// This job runs from a cron, with no logged-in user — so there's no
// organization to scope to. It goes through the normal app_runtime client
// and RLS with the platform-admin flag set (the same cross-org support
// access the policies already allow) rather than reaching for the
// owner-role client, which is reserved for the login bootstrap.
const SYSTEM_CONTEXT: TenantContext = {
  userId: "system:kit-expiry-cron",
  organizationId: null,
  isPlatformAdmin: true,
  role: "PLATFORM_ADMIN",
};

/**
 * Emails every user in an organization about its kits that expire within
 * KIT_EXPIRY_WARNING_DAYS (or already have) and haven't been marked ordered
 * or used. Meant to run daily; a kit is only re-emailed once
 * KIT_EMAIL_INTERVAL_DAYS have passed since its last email, so the effective
 * cadence is every 3 days until someone marks it ordered.
 *
 * Recipients are all users in the kit's organization (the address they
 * registered/log in with) — not just study assignees, since accounts created
 * from the Team page have no study assignments.
 *
 * Emails go out between two short transactions rather than inside one: an
 * interactive Prisma transaction has a few seconds to live, and a slow email
 * provider shouldn't be able to roll back the bookkeeping (or hold a
 * connection open). lastExpiryEmailAt is only written after sending.
 */
export async function runKitExpiryEmails(): Promise<{ kits: number; emails: number }> {
  const now = new Date();
  const warnBy = new Date(now.getTime() + KIT_EXPIRY_WARNING_DAYS * DAY_MS);
  // A daily cron never lands exactly 3.000 days after the previous run (it
  // drifts by seconds), so an exact 3-day cutoff would skip a day and turn
  // "every 3 days" into "every 4". Half a day of slack keeps it at 3.
  const resendBefore = new Date(now.getTime() - (KIT_EMAIL_INTERVAL_DAYS * DAY_MS - DAY_MS / 2));

  const due = await withTenantContext(SYSTEM_CONTEXT, async (tx) => {
    const kits = await tx.kit.findMany({
      where: {
        expiryDate: { lte: warnBy },
        orderedAt: null,
        usedAt: null,
        OR: [{ lastExpiryEmailAt: null }, { lastExpiryEmailAt: { lte: resendBefore } }],
      },
      select: {
        id: true,
        name: true,
        expiryDate: true,
        organizationId: true,
        study: { select: { protocolId: true } },
      },
      orderBy: { expiryDate: "asc" },
    });
    if (kits.length === 0) return { kits: [], emailsByOrg: new Map<string, string[]>() };

    const orgIds = [...new Set(kits.map((k) => k.organizationId))];
    const users = await tx.user.findMany({
      where: { organizationId: { in: orgIds } },
      select: { email: true, organizationId: true },
    });
    const emailsByOrg = new Map<string, string[]>();
    for (const u of users) {
      if (!u.organizationId) continue;
      emailsByOrg.set(u.organizationId, [...(emailsByOrg.get(u.organizationId) ?? []), u.email]);
    }
    return { kits, emailsByOrg };
  });

  if (due.kits.length === 0) return { kits: 0, emails: 0 };

  const appUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "");
  let emails = 0;
  const notifiedKitIds: string[] = [];

  for (const [orgId, recipients] of due.emailsByOrg) {
    const orgKits = due.kits.filter((k) => k.organizationId === orgId);
    if (orgKits.length === 0) continue;

    const lines = orgKits.map((k) => {
      const days = k.expiryDate ? Math.ceil((k.expiryDate.getTime() - now.getTime()) / DAY_MS) : 0;
      const when =
        days < 0
          ? `expired ${k.expiryDate!.toDateString()}`
          : `expires ${k.expiryDate!.toDateString()} (in ${days} day${days === 1 ? "" : "s"})`;
      return `- ${k.name} [${k.study.protocolId}] — ${when}`;
    });
    const text = [
      `${orgKits.length} kit${orgKits.length === 1 ? "" : "s"} expiring within ${KIT_EXPIRY_WARNING_DAYS / 7} weeks (or already expired) and not yet marked as ordered:`,
      ``,
      ...lines,
      ``,
      `Mark each kit as ordered in Kits Inventory${appUrl ? ` (${appUrl}/dashboard/kits)` : ""} to stop these reminders.`,
      `You'll keep getting this email every ${KIT_EMAIL_INTERVAL_DAYS} days until then.`,
      ``,
      `This is an automated reminder from SiteWell-ct.`,
    ].join("\n");
    const subject = `Kits expiring soon: ${orgKits.length} kit${orgKits.length === 1 ? "" : "s"} need${orgKits.length === 1 ? "s" : ""} ordering`;

    // One email per recipient so users don't see each other's addresses.
    for (const to of recipients) {
      await sendEmail({ to: [to], subject, text });
      emails++;
    }
    // Only kits whose org actually had someone to notify count as notified;
    // otherwise they'd be silently skipped for 3 days.
    if (recipients.length > 0) notifiedKitIds.push(...orgKits.map((k) => k.id));
  }

  if (notifiedKitIds.length > 0) {
    await withTenantContext(SYSTEM_CONTEXT, (tx) =>
      tx.kit.updateMany({ where: { id: { in: notifiedKitIds } }, data: { lastExpiryEmailAt: now } }),
    );
  }

  return { kits: notifiedKitIds.length, emails };
}
