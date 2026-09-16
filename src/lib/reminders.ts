import { requireTenantContext, withTenantContext } from "@/lib/db-context";

const REMINDER_DAYS_BEFORE = 3;

/**
 * No email provider is configured yet (prototype phase — see
 * PROJECT_SPEC.md section 7/8), so "sending" logs to the server console
 * instead of actually emailing anyone. Swap the body of this function for a
 * real provider call (Resend, SES, etc.) when one is wired up; every other
 * piece (the due-visit query, reminderSentAt bookkeeping) stays the same.
 */
async function sendReminderEmail(visit: {
  id: string;
  visitType: string;
  targetDate: Date;
  subject: { subjectCode: string };
  study: { protocolId: string };
}) {
  console.log(
    `[reminder] ${visit.study.protocolId} ${visit.subject.subjectCode} — ${visit.visitType} due ${visit.targetDate.toDateString()}`,
  );
}

/**
 * Finds SCHEDULED visits whose target date is within REMINDER_DAYS_BEFORE
 * days and haven't had a reminder sent yet, "sends" one, and records
 * reminderSentAt so re-running this doesn't notify twice.
 */
export async function runDueReminders(): Promise<number> {
  const ctx = await requireTenantContext();

  return withTenantContext(ctx, async (tx) => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000);

    const dueVisits = await tx.visit.findMany({
      where: {
        status: "SCHEDULED",
        reminderSentAt: null,
        targetDate: { gte: now, lte: cutoff },
      },
      include: {
        subject: { select: { subjectCode: true } },
        study: { select: { protocolId: true } },
      },
    });

    for (const visit of dueVisits) {
      await sendReminderEmail(visit);
      await tx.visit.update({ where: { id: visit.id }, data: { reminderSentAt: now } });
    }

    return dueVisits.length;
  });
}
