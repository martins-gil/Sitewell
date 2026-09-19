import type { SubjectStatus } from "@prisma/client";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { formatDate } from "@/lib/format";
import { KIT_EXPIRY_WARNING_DAYS, KIT_OVERVIEW_WINDOW_DAYS } from "@/lib/kits";
import { SCHEDULABLE_STATUSES } from "@/lib/visit-scheduling";
import { pickProtocolDocument } from "@/lib/protocol-document";

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

export async function getStudyById(studyId: string) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.study.findUnique({
      where: { id: studyId },
      include: { sites: { orderBy: { createdAt: "asc" }, take: 1, select: { siteNumber: true } } },
    }),
  );
}

/** The protocol document whose version/release date the study's checklist
 * documents print (see pickProtocolDocument), or null if it has none. */
export async function getStudyProtocolDocument(studyId: string) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, async (tx) => {
    const docs = await tx.document.findMany({
      where: { studyId, type: "PROTOCOL" },
      select: {
        id: true,
        title: true,
        version: true,
        releaseDate: true,
        status: true,
        expiryDate: true,
        signedAt: true,
        createdAt: true,
      },
    });
    return pickProtocolDocument(docs);
  });
}

/** Candidates for the Add-Patient form's "Duplicate visits from" picker —
 * only subjects that already have a visit list worth copying. */
export async function getSubjectsWithVisitCounts() {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.subject.findMany({
      select: { id: true, subjectCode: true, studyId: true, _count: { select: { visits: true } } },
      orderBy: { subjectCode: "asc" },
    }),
  );
}

export async function getStudyWithTemplates(studyId: string) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.study.findUnique({
      where: { id: studyId },
      include: {
        templates: { orderBy: { sortOrder: "asc" } },
        sites: { orderBy: { createdAt: "asc" }, take: 1 },
      },
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

export async function getChecklistTaskLibrary() {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.checklistTaskLibrary.findMany({ orderBy: { label: "asc" } }),
  );
}

export async function getSubjectById(id: string) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.subject.findUnique({
      where: { id },
      include: {
        study: {
          select: {
            id: true,
            title: true,
            protocolId: true,
            templates: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                studyId: true,
                name: true,
                windowBeforeDays: true,
                windowAfterDays: true,
              },
            },
          },
        },
        visits: { orderBy: { targetDate: "asc" } },
      },
    }),
  );
}

/** Everything the calendar's "Add a visit" form needs: the protocol visit
 * types per study, and the patients whose status allows scheduling, each
 * with which visit types they already have (so those aren't offered twice). */
export async function getVisitSchedulingData() {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, async (tx) => {
    const [templates, subjects] = await Promise.all([
      tx.visitScheduleTemplate.findMany({
        orderBy: [{ studyId: "asc" }, { sortOrder: "asc" }],
        select: { id: true, studyId: true, name: true, windowBeforeDays: true, windowAfterDays: true },
      }),
      tx.subject.findMany({
        where: { status: { in: SCHEDULABLE_STATUSES } },
        orderBy: { subjectCode: "asc" },
        select: {
          id: true,
          studyId: true,
          subjectCode: true,
          displayName: true,
          status: true,
          visits: { select: { templateId: true } },
        },
      }),
    ]);

    return {
      templates,
      subjects: subjects.map((s) => ({
        id: s.id,
        studyId: s.studyId,
        subjectCode: s.subjectCode,
        displayName: s.displayName,
        status: s.status as string,
        scheduledTemplateIds: s.visits.flatMap((v) => (v.templateId ? [v.templateId] : [])),
      })),
    };
  });
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
        kits: {
          select: { id: true, name: true, expiryDate: true, usedAt: true },
          orderBy: { name: "asc" },
        },
      },
    }),
  );
}

/**
 * Returns the visit's checklist (ordered items + verified state). Most rows
 * come from the visit type's ChecklistTemplateItem list, lazily copied into
 * VisitChecklistResult (with label/detail/sortOrder denormalized at creation
 * time) the first time this visit's checklist is viewed, so a new template
 * item automatically appears on every visit of that type without a backfill
 * migration. A visit can also have its own one-off rows (templateItemId
 * null, added via addVisitChecklistItem) since visits aren't static — see
 * the schema comment on VisitChecklistResult. `removed` rows are excluded
 * here but not deleted, so a removed template-derived item isn't seen as
 * "missing" and recreated next time this function runs.
 */
export async function getVisitChecklist(visitId: string) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, async (tx) => {
    const visit = await tx.visit.findUniqueOrThrow({
      where: { id: visitId },
      select: { organizationId: true, templateId: true },
    });

    if (visit.templateId) {
      const templateItems = await tx.checklistTemplateItem.findMany({
        where: { visitScheduleTemplateId: visit.templateId },
        select: { id: true, label: true, detail: true, sortOrder: true },
      });

      if (templateItems.length > 0) {
        const existing = await tx.visitChecklistResult.findMany({
          where: { visitId, templateItemId: { in: templateItems.map((i) => i.id) } },
          select: { templateItemId: true },
        });
        const existingItemIds = new Set(existing.map((r) => r.templateItemId));
        const missing = templateItems.filter((i) => !existingItemIds.has(i.id));

        if (missing.length > 0) {
          await tx.visitChecklistResult.createMany({
            data: missing.map((i) => ({
              organizationId: visit.organizationId,
              visitId,
              templateItemId: i.id,
              label: i.label,
              detail: i.detail,
              sortOrder: i.sortOrder,
            })),
            skipDuplicates: true,
          });
        }
      }
    }

    const results = await tx.visitChecklistResult.findMany({
      where: { visitId, removed: false },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "asc" }],
    });

    return results.map((r) => ({
      id: r.id,
      sortOrder: r.sortOrder,
      label: r.label,
      detail: r.detail,
      verified: r.verified,
      isAdHoc: r.templateItemId === null,
    }));
  });
}

/** Everything printed at the top, bottom and heading of a visit's checklist
 * document. PI name and site number are fixed facts about the study; the
 * protocol version and release date come from the study's protocol document
 * (see pickProtocolDocument); the "(V3)" label and the footnote belong to the
 * visit type's checklist. Nothing here is derived from who's logged in or
 * when someone downloads a copy. */
export async function getVisitChecklistHeader(visitId: string) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, async (tx) => {
    const visit = await tx.visit.findUniqueOrThrow({
      where: { id: visitId },
      include: {
        study: { include: { sites: { select: { siteNumber: true }, take: 1 } } },
        subject: { select: { subjectCode: true } },
        template: { select: { checklistVersion: true, checklistFootnote: true } },
      },
    });

    const protocolDocs = await tx.document.findMany({
      where: { studyId: visit.studyId, type: "PROTOCOL" },
      select: {
        id: true,
        title: true,
        version: true,
        releaseDate: true,
        status: true,
        expiryDate: true,
        signedAt: true,
        createdAt: true,
      },
    });
    const protocol = pickProtocolDocument(protocolDocs);

    return {
      visitType: visit.visitType,
      subjectCode: visit.subject.subjectCode,
      hasTemplate: visit.templateId !== null,
      studyId: visit.studyId,
      protocolId: visit.study.protocolId,
      piName: visit.study.piName,
      siteNumber: visit.study.sites[0]?.siteNumber ?? null,
      protocolVersion: protocol?.doc.version ?? null,
      protocolReleaseDate: protocol?.doc.releaseDate ?? null,
      protocolDocumentTitle: protocol?.doc.title ?? null,
      protocolAwaitingSignature: protocol?.awaitingSignature ?? false,
      checklistVersion: visit.template?.checklistVersion ?? null,
      checklistFootnote: visit.template?.checklistFootnote ?? null,
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

export async function getDocuments(filters: { studyId?: string } = {}) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.document.findMany({
      where: { studyId: filters.studyId || undefined },
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

/** Kits inventory. Used kits (usedAt set) are hidden unless showUsed. */
export async function getKits(filters: { studyId?: string; showUsed?: boolean } = {}) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.kit.findMany({
      where: {
        studyId: filters.studyId || undefined,
        usedAt: filters.showUsed ? undefined : null,
      },
      include: {
        study: { select: { protocolId: true } },
        visitScheduleTemplate: { select: { name: true } },
        visit: {
          select: {
            id: true,
            visitType: true,
            targetDate: true,
            actualDate: true,
            subject: { select: { subjectCode: true } },
          },
        },
      },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
    }),
  );
}

/** Kits that need the orange banner: expiring within the warning window or
 * already expired, and not yet marked ordered or used. */
export async function getExpiringKitAlerts() {
  const ctx = await requireTenantContext();
  const warnBy = new Date(Date.now() + KIT_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);
  return withTenantContext(ctx, (tx) =>
    tx.kit.findMany({
      where: { expiryDate: { lte: warnBy }, orderedAt: null, usedAt: null },
      select: {
        id: true,
        name: true,
        expiryDate: true,
        study: { select: { protocolId: true } },
      },
      orderBy: { expiryDate: "asc" },
    }),
  );
}

/** Overview card: kits (not yet used) expiring in the next two months, plus
 * how many have already expired. */
export async function getKitExpirySummary() {
  const ctx = await requireTenantContext();
  const now = new Date();
  const until = new Date(now.getTime() + KIT_OVERVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return withTenantContext(ctx, async (tx) => {
    const [expiringSoon, expired] = await Promise.all([
      tx.kit.count({ where: { usedAt: null, expiryDate: { gte: now, lte: until } } }),
      tx.kit.count({ where: { usedAt: null, expiryDate: { lt: now } } }),
    ]);
    return { expiringSoon, expired };
  });
}

/** Visits a kit can still be linked to (upcoming: scheduled or rescheduled),
 * for the Kits Inventory "link to a visit" pickers. Labels are built here so
 * server and client render the same text. */
export async function getLinkableVisits() {
  const ctx = await requireTenantContext();
  const visits = await withTenantContext(ctx, (tx) =>
    tx.visit.findMany({
      where: { status: { in: ["SCHEDULED", "RESCHEDULED"] } },
      select: {
        id: true,
        studyId: true,
        visitType: true,
        targetDate: true,
        subject: { select: { subjectCode: true } },
      },
      orderBy: { targetDate: "asc" },
    }),
  );
  return visits.map((v) => ({
    id: v.id,
    studyId: v.studyId,
    label: `${v.subject.subjectCode} · ${v.visitType} · ${formatDate(v.targetDate)}`,
  }));
}

/** Kits of a visit's study that aren't assigned to any visit yet and haven't
 * been used — what the visit page's "assign a kit" picker offers. */
export async function getAssignableKitsForStudy(studyId: string) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.kit.findMany({
      where: { studyId, visitId: null, usedAt: null },
      select: { id: true, name: true, expiryDate: true },
      orderBy: [{ expiryDate: "asc" }, { name: "asc" }],
    }),
  );
}

/** Studies with their visit types, for the Kits "assigned visit" cascading
 * dropdown (pick a study, then narrow to one of its visit types). */
export async function getStudiesWithTemplatesForKits() {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.study.findMany({
      orderBy: { title: "asc" },
      select: {
        id: true,
        protocolId: true,
        templates: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } },
      },
    }),
  );
}

export async function getTeamMembers() {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, mfaEnabled: true, createdAt: true },
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
