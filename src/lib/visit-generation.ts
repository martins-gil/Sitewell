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

/**
 * Adds the protocol visits a subject doesn't have yet, dated as offsets from
 * `anchorDate` (the Day 0 / Baseline date). Unlike generateVisitsForSubject,
 * this doesn't bail out when the subject already has some visits — it only
 * fills in the visit types that are missing, so a coordinator who scheduled
 * Screening by hand can still add the rest of the protocol in one step
 * without duplicating what's there.
 */
export async function generateMissingVisitsForSubject(
  tx: Prisma.TransactionClient,
  params: { subjectId: string; studyId: string; organizationId: string; anchorDate: Date },
): Promise<number> {
  const [templates, existing] = await Promise.all([
    tx.visitScheduleTemplate.findMany({
      where: { studyId: params.studyId },
      orderBy: { sortOrder: "asc" },
    }),
    tx.visit.findMany({ where: { subjectId: params.subjectId }, select: { templateId: true } }),
  ]);

  const alreadyScheduled = new Set(existing.map((v) => v.templateId));
  const missing = templates.filter((t) => !alreadyScheduled.has(t.id));
  if (missing.length === 0) return 0;

  await tx.visit.createMany({
    data: missing.map((template) => {
      const targetDate = addDays(params.anchorDate, template.targetDayOffset);
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

  return missing.length;
}
