"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { parseDateOnly } from "@/lib/visit-scheduling";
import { parseStartTime } from "@/lib/visit-time";

// Monitoring visits (see src/lib/monitoring.ts). Every action RETURNS its outcome
// instead of throwing: a thrown server-action error is masked in production, so a
// form couldn't say what was wrong.

export type MonitoringResult = { ok: true } | { ok: false; problem: string };
export type CreateMonitoringResult = { ok: true; id: string } | { ok: false; problem: string };

const MAX_POINTS = 200;

function refresh(id?: string) {
  revalidatePath("/dashboard/monitoring");
  revalidatePath("/dashboard/visits");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/dashboard/monitoring/${id}`);
}

type Point = { label: string; detail: string | null };

function cleanPoints(points: Point[]): Point[] {
  const seen = new Set<string>();
  return points
    .map((p) => ({ label: p.label.trim().slice(0, 250), detail: p.detail?.trim().slice(0, 400) || null }))
    .filter((p) => {
      const key = p.label.toLowerCase();
      if (!p.label || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_POINTS);
}

function readFields(formData: FormData) {
  const dateRaw = String(formData.get("visitDate") ?? "");
  return {
    dateRaw,
    startTime: parseStartTime(formData.get("startTime")),
    room: String(formData.get("room") ?? "").trim().slice(0, 120) || null,
    notes: String(formData.get("notes") ?? "").trim().slice(0, 2000) || null,
  };
}

/** Adds a monitoring visit. `copyFromId` (optional) starts it with another monitoring
 * visit's points, unticked. */
export async function createMonitoringVisit(formData: FormData): Promise<CreateMonitoringResult> {
  const ctx = await requireTenantContext();
  const studyId = String(formData.get("studyId") ?? "");
  const copyFromId = String(formData.get("copyFromId") ?? "") || null;
  const { dateRaw, startTime, room, notes } = readFields(formData);
  if (!studyId) return { ok: false, problem: "Pick a study." };
  if (!dateRaw) return { ok: false, problem: "Pick the date of the visit." };

  const id = await withTenantContext(ctx, async (tx) => {
    const study = await tx.study.findUniqueOrThrow({ where: { id: studyId } });
    const visit = await tx.monitoringVisit.create({
      data: { organizationId: study.organizationId, studyId, visitDate: parseDateOnly(dateRaw), startTime, room, notes },
    });
    if (copyFromId) {
      // Only from a visit of the SAME study, whatever the form sent.
      const source = await tx.monitoringVisit.findFirst({
        where: { id: copyFromId, studyId },
        include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
      });
      if (source && source.items.length > 0) {
        await tx.monitoringVisitItem.createMany({
          data: source.items.map((item, i) => ({
            organizationId: study.organizationId,
            monitoringVisitId: visit.id,
            label: item.label,
            detail: item.detail,
            sortOrder: i,
          })),
        });
      }
    }
    return visit.id;
  });

  refresh(id);
  return { ok: true, id };
}

export async function updateMonitoringVisit(id: string, formData: FormData): Promise<MonitoringResult> {
  const ctx = await requireTenantContext();
  const { dateRaw, startTime, room, notes } = readFields(formData);
  if (!dateRaw) return { ok: false, problem: "Pick the date of the visit." };

  await withTenantContext(ctx, (tx) =>
    tx.monitoringVisit.update({ where: { id }, data: { visitDate: parseDateOnly(dateRaw), startTime, room, notes } }),
  );
  refresh(id);
  return { ok: true };
}

export async function deleteMonitoringVisit(id: string): Promise<MonitoringResult> {
  const ctx = await requireTenantContext();
  // Its points go with it (ON DELETE CASCADE).
  await withTenantContext(ctx, (tx) => tx.monitoringVisit.delete({ where: { id } }));
  refresh();
  return { ok: true };
}

/** Adds points to verify, after the ones already there. */
export async function addMonitoringPoints(id: string, points: Point[]): Promise<{ ok: true; added: number } | { ok: false; problem: string }> {
  const ctx = await requireTenantContext();
  const list = cleanPoints(points);
  if (list.length === 0) return { ok: true, added: 0 };

  const outcome = await withTenantContext(ctx, async (tx) => {
    const visit = await tx.monitoringVisit.findUniqueOrThrow({ where: { id }, select: { organizationId: true } });
    const existing = await tx.monitoringVisitItem.aggregate({
      where: { monitoringVisitId: id },
      _max: { sortOrder: true },
      _count: true,
    });
    if (existing._count + list.length > MAX_POINTS) return { ok: false as const, problem: `A monitoring visit can have up to ${MAX_POINTS} points.` };
    let sortOrder = (existing._max.sortOrder ?? -1) + 1;
    await tx.monitoringVisitItem.createMany({
      data: list.map((p) => ({
        organizationId: visit.organizationId,
        monitoringVisitId: id,
        label: p.label,
        detail: p.detail,
        sortOrder: sortOrder++,
      })),
    });
    return { ok: true as const, added: list.length };
  });

  if (outcome.ok) refresh(id);
  return outcome;
}

export async function addMonitoringPoint(id: string, formData: FormData) {
  const label = String(formData.get("label") ?? "");
  const detail = String(formData.get("detail") ?? "");
  if (!label.trim()) return { ok: false as const, problem: "Write the point to verify." };
  return addMonitoringPoints(id, [{ label, detail: detail || null }]);
}

/** Adds another monitoring visit's points to this one (unticked), skipping repeats. */
export async function copyMonitoringPoints(id: string, fromId: string) {
  const ctx = await requireTenantContext();
  const points = await withTenantContext(ctx, async (tx) => {
    const visit = await tx.monitoringVisit.findUniqueOrThrow({ where: { id }, select: { studyId: true } });
    const source = await tx.monitoringVisit.findFirst({
      where: { id: fromId, studyId: visit.studyId },
      include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    });
    const mine = await tx.monitoringVisitItem.findMany({ where: { monitoringVisitId: id }, select: { label: true } });
    const have = new Set(mine.map((m) => m.label.trim().toLowerCase()));
    return (source?.items ?? []).filter((i) => !have.has(i.label.trim().toLowerCase())).map((i) => ({ label: i.label, detail: i.detail }));
  });
  return addMonitoringPoints(id, points);
}

export async function setMonitoringPointVerified(id: string, itemId: string, verified: boolean): Promise<MonitoringResult> {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) =>
    tx.monitoringVisitItem.updateMany({ where: { id: itemId, monitoringVisitId: id }, data: { verified } }),
  );
  revalidatePath(`/dashboard/monitoring/${id}`);
  revalidatePath("/dashboard/monitoring");
  return { ok: true };
}

export async function removeMonitoringPoint(id: string, itemId: string): Promise<MonitoringResult> {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) => tx.monitoringVisitItem.deleteMany({ where: { id: itemId, monitoringVisitId: id } }));
  refresh(id);
  return { ok: true };
}
