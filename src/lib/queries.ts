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
