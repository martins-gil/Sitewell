import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { ieFormHeader } from "@/lib/queries";
import { compareStartTime } from "@/lib/visit-time";

// Monitoring visits: a monitor's (CRA's) visit to the site for one study — date,
// time, room, and a list of points to verify during it. Read helpers for the
// pages, the calendar and the printed document; the writes are in
// src/app/dashboard/monitoring/actions.ts.

/** The list page: every monitoring visit with how far through its points it is. */
export async function getMonitoringVisits() {
  const ctx = await requireTenantContext();
  const rows = await withTenantContext(ctx, (tx) =>
    tx.monitoringVisit.findMany({
      orderBy: { visitDate: "asc" },
      select: {
        id: true,
        studyId: true,
        visitDate: true,
        startTime: true,
        room: true,
        study: { select: { protocolId: true, title: true } },
        items: { select: { verified: true } },
      },
    }),
  );
  return rows
    .map((v) => ({
      id: v.id,
      studyId: v.studyId,
      protocolId: v.study.protocolId,
      studyTitle: v.study.title,
      visitDate: v.visitDate,
      startTime: v.startTime,
      room: v.room,
      pointCount: v.items.length,
      verifiedCount: v.items.filter((i) => i.verified).length,
    }))
    .sort((a, b) => a.visitDate.getTime() - b.visitDate.getTime() || compareStartTime(a.startTime, b.startTime));
}

export async function getMonitoringVisitById(id: string) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.monitoringVisit.findUnique({
      where: { id },
      include: {
        study: { select: { id: true, protocolId: true, title: true } },
        items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      },
    }),
  );
}

/** Other monitoring visits of the same study, newest first — to copy their points from. */
export async function getCopySources(studyId: string, exceptId: string) {
  const ctx = await requireTenantContext();
  const rows = await withTenantContext(ctx, (tx) =>
    tx.monitoringVisit.findMany({
      where: { studyId, id: { not: exceptId }, items: { some: {} } },
      orderBy: { visitDate: "desc" },
      take: 20,
      select: { id: true, visitDate: true, room: true, _count: { select: { items: true } } },
    }),
  );
  return rows.map((r) => ({ id: r.id, visitDate: r.visitDate, room: r.room, points: r._count.items }));
}

/** What the calendar draws: one small record per monitoring visit. */
export type CalendarMonitoring = {
  id: string;
  studyId: string;
  protocolId: string;
  targetDate: string; // ISO date string
  startTime: string | null;
  room: string | null;
  pointCount: number;
  verifiedCount: number;
};

export async function getMonitoringForCalendar(): Promise<CalendarMonitoring[]> {
  const list = await getMonitoringVisits();
  return list.map((v) => ({
    id: v.id,
    studyId: v.studyId,
    protocolId: v.protocolId,
    targetDate: v.visitDate.toISOString(),
    startTime: v.startTime,
    room: v.room,
    pointCount: v.pointCount,
    verifiedCount: v.verifiedCount,
  }));
}

/** Everything the printed points document needs (header block, title, points). */
export async function getMonitoringDocument(id: string) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, async (tx) => {
    const visit = await tx.monitoringVisit.findUnique({
      where: { id },
      include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    });
    if (!visit) return null;
    const { header } = await ieFormHeader(tx, visit.studyId);
    return { visit, header };
  });
}
