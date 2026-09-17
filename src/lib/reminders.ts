import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { sendEmail } from "@/lib/email";

const REMINDER_DAYS_BEFORE = 3;

async function sendReminderEmail(
  visit: {
    visitType: string;
    targetDate: Date;
    subject: { subjectCode: string };
    study: { protocolId: string };
  },
  recipients: string[],
) {
  const subject = `[${visit.study.protocolId}] Upcoming visit: ${visit.subject.subjectCode} — ${visit.visitType}`;
  const text = [
    `${visit.subject.subjectCode} has a ${visit.visitType} visit coming up.`,
    `Study: ${visit.study.protocolId}`,
    `Target date: ${visit.targetDate.toDateString()}`,
    ``,
    `This is an automated reminder from SiteWell-ct.`,
  ].join("\n");

  await sendEmail({ to: recipients, subject, text });
}

/**
 * Finds SCHEDULED visits whose target date is within REMINDER_DAYS_BEFORE
 * days and haven't had a reminder sent yet, emails everyone assigned to
 * that study (see study_assignments), and records reminderSentAt so
 * re-running this doesn't notify twice.
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
        study: {
          select: {
            protocolId: true,
            assignments: { select: { user: { select: { email: true } } } },
          },
        },
      },
    });

    for (const visit of dueVisits) {
      const recipients = visit.study.assignments.map((a) => a.user.email);
      await sendReminderEmail(visit, recipients);
      await tx.visit.update({ where: { id: visit.id }, data: { reminderSentAt: now } });
    }

    return dueVisits.length;
  });
}
