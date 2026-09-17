import type { SubjectStatus } from "@prisma/client";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";

export async function getCurrentUser() {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { id: true, name: true, email: true, role: true, mfaEnabled: true },
    }),
  );
}

export async function getStudies() {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.study.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, protocolId: true, status: true },
    }),
  );
}

export async function getSubjects(filters: { studyId?: string; status?: SubjectStatus }) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.subject.findMany({
      where: {
        studyId: filters.studyId || undefined,
        status: filters.status || undefined,
      },
      include: { study: { select: { title: true, protocolId: true } } },
      orderBy: { createdAt: "desc" },
    }),
  );
}

export async function getStudyWithTemplates(studyId: string) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.study.findUnique({
      where: { id: studyId },
      include: { templates: { orderBy: { sortOrder: "asc" } } },
    }),
  );
}

export async function getTemplateWithChecklist(templateId: string) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.visitScheduleTemplate.findUnique({
      where: { id: templateId },
      include: {
        study: { select: { id: true, protocolId: true } },
        checklistItems: { orderBy: { sortOrder: "asc" } },
      },
    }),
  );
}

export async function getSubjectById(id: string) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.subject.findUnique({
      where: { id },
      include: {
        study: { select: { id: true, title: true, protocolId: true } },
        visits: { orderBy: { targetDate: "asc" } },
      },
    }),
  );
}

export async function getVisitById(id: string) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.visit.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, subjectCode: true } },
        study: { select: { id: true, title: true, protocolId: true } },
        documents: {
          include: { signedBy: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  );
}

/**
 * Returns the visit's checklist (ordered items + verified state), creating
 * any missing VisitChecklistResult rows first — lazy so that adding a new
 * checklist item to a template automatically appears on every visit of
 * that type without a backfill migration.
 */
export async function getVisitChecklist(visitId: string) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, async (tx) => {
    const visit = await tx.visit.findUniqueOrThrow({
      where: { id: visitId },
      select: { organizationId: true, templateId: true },
    });
    if (!visit.templateId) return [];

    const items = await tx.checklistTemplateItem.findMany({
      where: { visitScheduleTemplateId: visit.templateId },
      orderBy: { sortOrder: "asc" },
    });
    if (items.length === 0) return [];

    const existing = await tx.visitChecklistResult.findMany({
      where: { visitId, templateItemId: { in: items.map((i) => i.id) } },
    });
    const existingItemIds = new Set(existing.map((r) => r.templateItemId));
    const missing = items.filter((i) => !existingItemIds.has(i.id));

    if (missing.length > 0) {
      await tx.visitChecklistResult.createMany({
        data: missing.map((i) => ({
          organizationId: visit.organizationId,
          visitId,
          templateItemId: i.id,
        })),
        skipDuplicates: true,
      });
    }

    const results = await tx.visitChecklistResult.findMany({
      where: { visitId, templateItemId: { in: items.map((i) => i.id) } },
    });
    const verifiedByItemId = new Map(results.map((r) => [r.templateItemId, r.verified]));

    return items.map((item) => ({
      id: item.id,
      sortOrder: item.sortOrder,
      label: item.label,
      detail: item.detail,
      verified: verifiedByItemId.get(item.id) ?? false,
    }));
  });
}

/** Header fields for the generated checklist document: PI name, site
 * number, protocol/amendment. Best-effort — clinical trial sites vary in
 * how they track "the" PI for a study, so this takes the first PI assigned
 * to the study and the org's first site, falling back to blanks. */
export async function getVisitChecklistHeader(visitId: string) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, async (tx) => {
    const visit = await tx.visit.findUniqueOrThrow({
      where: { id: visitId },
      include: {
        study: {
          include: {
            assignments: { include: { user: { select: { name: true, role: true } } } },
            sites: { select: { siteNumber: true } },
          },
        },
        subject: { select: { subjectCode: true } },
      },
    });

    const pi = visit.study.assignments.find((a) => a.user.role === "PI")?.user.name ?? null;
    const siteNumber = visit.study.sites[0]?.siteNumber ?? null;

    return {
      visitType: visit.visitType,
      protocolId: visit.study.protocolId,
      protocolAmendment: visit.study.protocolAmendment,
      subjectCode: visit.subject.subjectCode,
      piName: pi,
      siteNumber,
    };
  });
}

export async function getSubjectFunnelStats() {
  const ctx = await requireTenantContext();
  const grouped = await withTenantContext(ctx, (tx) =>
    tx.subject.groupBy({ by: ["status"], _count: { _all: true } }),
  );
  const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
  const enrolled = byStatus.ENROLLED ?? 0;
  const screenFailedOrWithdrawn = (byStatus.SCREEN_FAILED ?? 0) + (byStatus.WITHDRAWN ?? 0);
  const conversionRate = total > 0 ? Math.round((enrolled / total) * 100) : 0;
  return { byStatus, total, conversionRate, screenFailedOrWithdrawn };
}

export async function getUpcomingVisits(daysAhead = 30) {
  const ctx = await requireTenantContext();
  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return withTenantContext(ctx, (tx) =>
    tx.visit.findMany({
      where: { targetDate: { gte: now, lte: until } },
      include: {
        subject: { select: { subjectCode: true } },
        study: { select: { title: true, protocolId: true } },
      },
      orderBy: { targetDate: "asc" },
    }),
  );
}

export async function getAllVisits() {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.visit.findMany({
      include: {
        subject: { select: { subjectCode: true } },
        study: { select: { title: true, protocolId: true } },
      },
      orderBy: { targetDate: "asc" },
    }),
  );
}

export async function getDocuments() {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.document.findMany({
      include: {
        study: { select: { title: true, protocolId: true } },
        signedBy: { select: { name: true } },
      },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
    }),
  );
}

export async function getFeedbackSubmissions() {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.feedbackSubmission.findMany({
      include: { submittedBy: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
    }),
  );
}

export async function getExpiringDocuments(daysAhead = 60) {
  const ctx = await requireTenantContext();
  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return withTenantContext(ctx, (tx) =>
    tx.document.findMany({
      where: { expiryDate: { gte: now, lte: until } },
      include: { study: { select: { title: true, protocolId: true } } },
      orderBy: { expiryDate: "asc" },
    }),
  );
}
