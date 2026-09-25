import { withTenantContext, type TenantContext } from "@/lib/db-context";
import { sendEmail } from "@/lib/email";
import { makeConfirmToken } from "@/lib/sample-confirm";

// The afternoon shipment-confirmation e-mail: for every shipment recorded for TODAY, ask
// "were these samples actually shipped?" — like a meeting invite, a Yes link and a No link,
// the latter opening a page with a reason box (src/app/samples-confirm/). Meant to run once
// a day in the afternoon (see vercel.json); a shipment is only ever asked about once
// (confirmationSentAt), whatever the answer or lack of one. Same shape as the kit-expiry and
// kit-stock jobs: cron-only, no logged-in user, so it runs through the normal app_runtime
// client with a synthetic platform-admin context — never prisma-auth.ts.
const SYSTEM_CONTEXT: TenantContext = {
  userId: "system:sample-confirm-cron",
  organizationId: null,
  isPlatformAdmin: true,
  role: "PLATFORM_ADMIN",
};

export async function runSampleShipmentConfirmations(): Promise<{ shipments: number; emails: number }> {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const due = await withTenantContext(SYSTEM_CONTEXT, async (tx) => {
    const shipments = await tx.labShipment.findMany({
      where: { shipDate: { gte: todayStart, lt: todayEnd }, confirmationSentAt: null },
      select: {
        id: true,
        organizationId: true,
        awb: true,
        ambientCount: true,
        refrigeratedCount: true,
        frozenCount: true,
        study: { select: { protocolId: true } },
      },
    });
    if (shipments.length === 0) return { shipments: [], emailsByOrg: new Map<string, string[]>() };

    const orgIds = [...new Set(shipments.map((s) => s.organizationId))];
    const users = await tx.user.findMany({ where: { organizationId: { in: orgIds } }, select: { email: true, organizationId: true } });
    const emailsByOrg = new Map<string, string[]>();
    for (const u of users) {
      if (!u.organizationId) continue;
      emailsByOrg.set(u.organizationId, [...(emailsByOrg.get(u.organizationId) ?? []), u.email]);
    }
    return { shipments, emailsByOrg };
  });

  if (due.shipments.length === 0) return { shipments: 0, emails: 0 };

  const appUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "");
  let emails = 0;
  const notifiedShipmentIds: string[] = [];

  for (const shipment of due.shipments) {
    const recipients = due.emailsByOrg.get(shipment.organizationId) ?? [];
    if (recipients.length === 0) continue;

    const token = makeConfirmToken(shipment.id, shipment.organizationId);
    if (!token || !appUrl) continue; // no AUTH_SECRET or no site address: can't build a working link
    const total = shipment.ambientCount + shipment.refrigeratedCount + shipment.frozenCount;
    const yesUrl = `${appUrl}/samples-confirm/${token}?answer=yes`;
    const noUrl = `${appUrl}/samples-confirm/${token}?answer=no`;
    const subject = `Confirm: were today's samples shipped? (${shipment.study.protocolId}, AWB ${shipment.awb})`;
    const text = [
      `A shipment was logged for today for ${shipment.study.protocolId}:`,
      ``,
      `- AWB ${shipment.awb} — ${total} sample${total === 1 ? "" : "s"} (${shipment.ambientCount} ambient, ${shipment.refrigeratedCount} refrigerated, ${shipment.frozenCount} frozen)`,
      ``,
      `Were the samples actually shipped?`,
      ``,
      `Yes, they were shipped: ${yesUrl}`,
      `No, they weren't: ${noUrl}`,
      ``,
      `Clicking "No" will ask for a short reason.`,
      ``,
      `This is an automated message from SiteWell-ct.`,
    ].join("\n");

    for (const to of recipients) {
      await sendEmail({ to: [to], subject, text });
      emails++;
    }
    notifiedShipmentIds.push(shipment.id);
  }

  if (notifiedShipmentIds.length > 0) {
    await withTenantContext(SYSTEM_CONTEXT, (tx) =>
      tx.labShipment.updateMany({ where: { id: { in: notifiedShipmentIds } }, data: { confirmationSentAt: now } }),
    );
  }

  return { shipments: notifiedShipmentIds.length, emails };
}
