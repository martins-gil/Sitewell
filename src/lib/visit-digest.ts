import { withTenantContext, type TenantContext } from "@/lib/db-context";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { compareStartTime } from "@/lib/visit-time";
import { fillTemplate, readTemplates, type VisitAlertTemplates } from "@/lib/visit-alert-templates";

// The weekly heads-up: on Wednesdays and Thursdays, everyone who asked for it gets
// a message listing the visits — patients' visits and monitoring visits — planned
// for the FOLLOWING week (Monday to Sunday). It is the visits' counterpart of the
// kit-expiry email (src/lib/kit-reminders.ts) and runs the same way: from a cron
// job with no logged-in user, through the normal app_runtime client with the
// platform-admin flag, never the owner-role client.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days the digest goes out, counted in UTC (0 = Sunday). Change here to move it. */
export const DIGEST_WEEKDAYS = [3, 4];

// A retried job (or a double run) must not message the same person twice.
const MIN_GAP_MS = 20 * 60 * 60 * 1000;
// Three text-message segments; longer than this gets expensive and unreadable.
const SMS_MAX_CHARS = 480;

const SYSTEM_CONTEXT: TenantContext = {
  userId: "system:visit-digest-cron",
  organizationId: null,
  isPlatformAdmin: true,
  role: "PLATFORM_ADMIN",
};

const locale = () => process.env.DIGEST_LOCALE || "en-GB";

/** The Monday-to-Sunday week after the one `now` is in: start (inclusive), end (exclusive). */
export function followingWeek(now: Date): { start: Date; end: Date } {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const start = new Date(today + (7 - daysSinceMonday) * DAY_MS);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

const shortDay = (date: Date) =>
  date.toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function weekLabel(start: Date): string {
  return `${shortDay(start)} – ${shortDay(new Date(start.getTime() + 6 * DAY_MS))}`;
}

/** One visit in the message, whatever kind it is. */
export type DigestItem = { date: Date; time: string | null; text: string };

type VisitRow = {
  targetDate: Date;
  startTime: string | null;
  visitType: string;
  subject: { subjectCode: string };
  study: { protocolId: string };
};
type MonitoringRow = { visitDate: Date; startTime: string | null; room: string | null; study: { protocolId: string } };

/** The visits (patients' and monitoring) of one organization as message lines. */
export function toDigestItems(visits: VisitRow[], monitoring: MonitoringRow[]): DigestItem[] {
  return [
    ...visits.map((v) => ({
      date: v.targetDate,
      time: v.startTime,
      text: `${v.subject.subjectCode} — ${v.visitType} (${v.study.protocolId})`,
    })),
    ...monitoring.map((m) => ({
      date: m.visitDate,
      time: m.startTime,
      text: `Monitoring visit — ${m.study.protocolId}${m.room ? ` · ${m.room}` : ""}`,
    })),
  ];
}

export function sortItems(items: DigestItem[]): DigestItem[] {
  return [...items].sort((a, b) => a.date.getTime() - b.date.getTime() || compareStartTime(a.time, b.time));
}

const emailLine = (i: DigestItem) => `- ${shortDay(i.date)}${i.time ? `, ${i.time}` : ""} — ${i.text}`;
const smsPiece = (i: DigestItem) =>
  `${i.date.toLocaleDateString(locale(), { weekday: "short", day: "numeric", timeZone: "UTC" })}${i.time ? ` ${i.time}` : ""} ${i.text}`;

export type ComposedMessages = { emailSubject: string; emailBody: string; sms: string };

/** One recipient's email and text, from the organization's wording. */
export function composeMessages(
  templates: VisitAlertTemplates,
  params: { name: string; weekStart: Date; items: DigestItem[]; link: string },
): ComposedMessages {
  const items = sortItems(params.items);
  const base = {
    name: params.name.trim().split(/\s+/)[0] || params.name,
    week: weekLabel(params.weekStart),
    count: String(items.length),
    link: params.link,
  };

  // A text has to stay short: fit as many visits as the budget allows, then "+N more".
  const withoutVisits = fillTemplate(templates.smsBody, { ...base, visits: "" });
  const budget = Math.max(0, SMS_MAX_CHARS - withoutVisits.length);
  const pieces: string[] = [];
  let used = 0;
  for (const [n, item] of items.entries()) {
    const piece = smsPiece(item);
    const remainingNote = ` +${items.length - n} more`;
    if (used + piece.length + 2 > budget - (n < items.length - 1 ? remainingNote.length : 0) && pieces.length > 0) {
      pieces.push(`+${items.length - n} more`);
      break;
    }
    pieces.push(piece);
    used += piece.length + 2;
  }

  return {
    emailSubject: fillTemplate(templates.emailSubject, { ...base, visits: "" }),
    emailBody: fillTemplate(templates.emailBody, { ...base, visits: items.map(emailLine).join("\n") }),
    sms: fillTemplate(templates.smsBody, { ...base, visits: pieces.join("; ") }),
  };
}

export type DigestResult = {
  skipped?: string;
  weekStart?: string;
  organizations: number;
  emails: number;
  texts: number;
  failures: number;
};

/**
 * Sends the digest. Meant for the cron job on Wednesdays and Thursdays; with
 * `force` it runs on any day and ignores the "already sent today" guard (for a
 * manual trial of the wiring).
 */
export async function runVisitDigest(options: { now?: Date; force?: boolean } = {}): Promise<DigestResult> {
  const now = options.now ?? new Date();
  const empty: DigestResult = { organizations: 0, emails: 0, texts: 0, failures: 0 };
  if (!options.force && !DIGEST_WEEKDAYS.includes(now.getUTCDay())) {
    return { ...empty, skipped: "Not a day the weekly visit message goes out." };
  }

  const { start, end } = followingWeek(now);
  const dueBefore = new Date(now.getTime() - MIN_GAP_MS);

  const data = await withTenantContext(SYSTEM_CONTEXT, async (tx) => {
    const [visits, monitoring, users, orgs] = await Promise.all([
      tx.visit.findMany({
        where: { status: { in: ["SCHEDULED", "RESCHEDULED"] }, targetDate: { gte: start, lt: end } },
        select: {
          organizationId: true,
          targetDate: true,
          startTime: true,
          visitType: true,
          subject: { select: { subjectCode: true } },
          study: { select: { protocolId: true } },
        },
      }),
      tx.monitoringVisit.findMany({
        where: { visitDate: { gte: start, lt: end } },
        select: { organizationId: true, visitDate: true, startTime: true, room: true, study: { select: { protocolId: true } } },
      }),
      tx.user.findMany({
        where: {
          organizationId: { not: null },
          OR: [{ notifyEmail: true }, { notifySms: true, phone: { not: null }, smsConsentAt: { not: null } }],
          ...(options.force ? {} : { AND: [{ OR: [{ lastVisitDigestAt: null }, { lastVisitDigestAt: { lt: dueBefore } }] }] }),
        },
        select: { id: true, name: true, email: true, phone: true, notifyEmail: true, notifySms: true, smsConsentAt: true, organizationId: true },
      }),
      tx.organization.findMany({ select: { id: true, visitAlertTemplates: true } }),
    ]);
    return { visits, monitoring, users, orgs };
  });

  const appUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const link = appUrl ? `${appUrl}/dashboard/visits` : "";
  const result: DigestResult = { ...empty, weekStart: start.toISOString().slice(0, 10) };
  const messaged: string[] = [];

  for (const org of data.orgs) {
    const items = toDigestItems(
      data.visits.filter((v) => v.organizationId === org.id),
      data.monitoring.filter((m) => m.organizationId === org.id),
    );
    const recipients = data.users.filter((u) => u.organizationId === org.id);
    if (items.length === 0 || recipients.length === 0) continue;
    result.organizations++;

    const templates = readTemplates(org.visitAlertTemplates);
    for (const user of recipients) {
      const message = composeMessages(templates, { name: user.name, weekStart: start, items, link });
      let delivered = false;
      // One message per person, so nobody sees anybody else's address or number.
      if (user.notifyEmail) {
        const sent = await sendEmail({ to: [user.email], subject: message.emailSubject, text: message.emailBody });
        if (sent.ok) {
          result.emails++;
          delivered = true;
        } else result.failures++;
      }
      if (user.notifySms && user.phone && user.smsConsentAt) {
        const sent = await sendSms({ to: user.phone, body: message.sms });
        if (sent.ok) {
          result.texts++;
          delivered = true;
        } else result.failures++;
      }
      if (delivered) messaged.push(user.id);
    }
  }

  // Bookkeeping after sending, in its own short transaction, so a slow provider
  // can't roll it back (or hold a database connection open).
  if (messaged.length > 0) {
    await withTenantContext(SYSTEM_CONTEXT, (tx) =>
      tx.user.updateMany({ where: { id: { in: messaged } }, data: { lastVisitDigestAt: now } }),
    );
  }
  return result;
}
