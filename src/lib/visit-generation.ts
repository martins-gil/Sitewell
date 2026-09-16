import type { Prisma } from "@prisma/client";

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Creates one Visit per VisitScheduleTemplate row for the subject's study,
 * offset from enrolledAt per PROJECT_SPEC.md Module 2 ("auto-calculate
 * target date + window per subject on enrollment"). Idempotent — if the
 * subject already has generated visits, does nothing, so re-saving an
 * already-enrolled subject's status can't create duplicates.
 */
export async function generateVisitsForSubject(
  tx: Prisma.TransactionClient,
  params: { subjectId: string; studyId: string; organizationId: string; enrolledAt: Date },
): Promise<number> {
  const existing = await tx.visit.count({ where: { subjectId: params.subjectId } });
  if (existing > 0) return 0;

  const templates = await tx.visitScheduleTemplate.findMany({
    where: { studyId: params.studyId },
    orderBy: { sortOrder: "asc" },
  });

  if (templates.length === 0) return 0;

  await tx.visit.createMany({
    data: templates.map((template) => {
      const targetDate = addDays(params.enrolledAt, template.targetDayOffset);
      return {
        organizationId: params.organizationId,
        subjectId: params.subjectId,
        studyId: params.studyId,
        templateId: template.id,
        visitType: template.name,
        targetDate,
        windowStart: addDays(targetDate, -template.windowBeforeDays),
        windowEnd: addDays(targetDate, template.windowAfterDays),
        status: "SCHEDULED" as const,
      };
    }),
  });

  return templates.length;
}
