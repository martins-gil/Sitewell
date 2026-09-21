"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { emailConfigured, sendEmail } from "@/lib/email";
import { normalizePhone, sendSms, smsConfigured } from "@/lib/sms";
import { tooBusy } from "@/lib/throttle";
import { checkTemplates, readTemplates } from "@/lib/visit-alert-templates";
import { composeMessages, followingWeek, toDigestItems, type DigestItem } from "@/lib/visit-digest";

// Notification settings. Every action returns its outcome (a thrown server-action
// error is masked in production, so a form couldn't say what was wrong).

export type SettingsResult = { ok: true } | { ok: false; problem: string };

/** The signed-in user's own phone number and what they want to receive. */
export async function saveMyNotifications(formData: FormData): Promise<SettingsResult> {
  const ctx = await requireTenantContext();

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) {
    return { ok: false, problem: "That doesn't look like a phone number. Use the international format, for example +351 912 345 678." };
  }
  const notifyEmail = formData.get("notifyEmail") === "on";
  const notifySms = formData.get("notifySms") === "on";
  if (notifySms && !phone) return { ok: false, problem: "Add your mobile number to receive text messages." };

  await withTenantContext(ctx, async (tx) => {
    const current = await tx.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { smsConsentAt: true } });
    await tx.user.update({
      where: { id: ctx.userId },
      data: {
        phone,
        notifyEmail,
        notifySms,
        // When they said yes to text messages; cleared when they say no.
        smsConsentAt: notifySms ? (current.smsConsentAt ?? new Date()) : null,
      },
    });
  });

  revalidatePath("/dashboard/settings/notifications");
  return { ok: true };
}

function requireOrgAdmin(ctx: { role: string; isPlatformAdmin: boolean; organizationId: string | null }) {
  return (ctx.role === "ORG_ADMIN" || ctx.isPlatformAdmin) && ctx.organizationId !== null;
}

/** The organization's own wording for the weekly email and text (org admins only). */
export async function saveAlertTemplates(formData: FormData): Promise<SettingsResult> {
  const ctx = await requireTenantContext();
  if (!requireOrgAdmin(ctx)) return { ok: false, problem: "Only an organization admin can change the wording." };

  const checked = checkTemplates({
    emailSubject: String(formData.get("emailSubject") ?? ""),
    emailBody: String(formData.get("emailBody") ?? "").replace(/\r\n/g, "\n"),
    smsBody: String(formData.get("smsBody") ?? ""),
  });
  if (!checked.ok) return checked;

  await withTenantContext(ctx, (tx) =>
    tx.organization.update({ where: { id: ctx.organizationId! }, data: { visitAlertTemplates: checked.templates } }),
  );
  revalidatePath("/dashboard/settings/notifications");
  return { ok: true };
}

/** Goes back to the built-in wording. */
export async function resetAlertTemplates(): Promise<SettingsResult> {
  const ctx = await requireTenantContext();
  if (!requireOrgAdmin(ctx)) return { ok: false, problem: "Only an organization admin can change the wording." };
  await withTenantContext(ctx, (tx) =>
    tx.organization.update({ where: { id: ctx.organizationId! }, data: { visitAlertTemplates: Prisma.DbNull } }),
  );
  revalidatePath("/dashboard/settings/notifications");
  return { ok: true };
}

export type TestMessageResult =
  | {
      ok: true;
      // What happened to each channel. "logged" = no email/SMS service is connected yet,
      // so the message was only written to the server log.
      email: "sent" | "logged" | "failed" | "off";
      sms: "sent" | "logged" | "failed" | "off";
      usedExample: boolean;
      emailProvider: boolean;
      smsProvider: boolean;
    }
  | { ok: false; problem: string };

/**
 * Sends the signed-in user the message they'd get on Wednesday, using the
 * organization's wording and next week's real visits (or a clearly marked example
 * when there are none), so the wording and the email / SMS connections can be
 * checked without waiting for the schedule.
 */
export async function sendTestMessage(): Promise<TestMessageResult> {
  const ctx = await requireTenantContext();
  if (tooBusy(`test-message:${ctx.userId}`, 3)) return { ok: false, problem: "Please wait a minute before sending another test." };

  const { start, end } = followingWeek(new Date());
  const data = await withTenantContext(ctx, async (tx) => {
    const [me, org, visits, monitoring] = await Promise.all([
      tx.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { name: true, email: true, phone: true, notifyEmail: true, notifySms: true, smsConsentAt: true },
      }),
      ctx.organizationId
        ? tx.organization.findUnique({ where: { id: ctx.organizationId }, select: { visitAlertTemplates: true } })
        : Promise.resolve(null),
      tx.visit.findMany({
        where: { status: { in: ["SCHEDULED", "RESCHEDULED"] }, targetDate: { gte: start, lt: end } },
        select: {
          targetDate: true,
          startTime: true,
          visitType: true,
          subject: { select: { subjectCode: true } },
          study: { select: { protocolId: true } },
        },
      }),
      tx.monitoringVisit.findMany({
        where: { visitDate: { gte: start, lt: end } },
        select: { visitDate: true, startTime: true, room: true, study: { select: { protocolId: true } } },
      }),
    ]);
    return { me, org, visits, monitoring };
  });

  let items: DigestItem[] = toDigestItems(data.visits, data.monitoring);
  const usedExample = items.length === 0;
  if (usedExample) {
    const day = (n: number) => new Date(start.getTime() + n * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
    items = [
      { date: day(2), time: "09:00", text: "RCN-101-0001 — Week 4 (RCN-101) (example)" },
      { date: day(3), time: "14:00", text: "Monitoring visit — RCN-101 · Room 2 (example)" },
    ];
  }

  const appUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const message = composeMessages(readTemplates(data.org?.visitAlertTemplates), {
    name: data.me.name,
    weekStart: start,
    items,
    link: appUrl ? `${appUrl}/dashboard/visits` : "",
  });

  // A test goes to the person's own email always; a text only if they have a number and said yes to texts.
  const emailSent = await sendEmail({ to: [data.me.email], subject: `[Test] ${message.emailSubject}`, text: message.emailBody });
  const email: "sent" | "logged" | "failed" = !emailSent.ok ? "failed" : emailSent.sent ? "sent" : "logged";

  let sms: "sent" | "logged" | "failed" | "off" = "off";
  if (data.me.phone && data.me.notifySms && data.me.smsConsentAt) {
    const smsSent = await sendSms({ to: data.me.phone, body: `[Test] ${message.sms}` });
    sms = !smsSent.ok ? "failed" : smsSent.sent ? "sent" : "logged";
  }

  return { ok: true, email, sms, usedExample, emailProvider: emailConfigured(), smsProvider: smsConfigured() };
}
