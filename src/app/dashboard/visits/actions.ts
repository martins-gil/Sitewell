"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { generateMissingVisitsForSubject } from "@/lib/visit-generation";
import { canScheduleVisits } from "@/lib/visit-scheduling";

const DAY_MS = 24 * 60 * 60 * 1000;

function refresh() {
  revalidatePath("/dashboard/visits");
  revalidatePath("/dashboard");
}

// Noon UTC, not midnight: a date-only value stays on the same calendar day
// for anyone within ±12 hours of UTC, instead of slipping to the day before
// west of Greenwich.
function parseDateOnly(raw: string): Date {
  const date = new Date(`${raw}T12:00:00Z`);
  if (!raw || Number.isNaN(date.getTime())) throw new Error("Enter a valid date.");
  return date;
}

function wholeDays(raw: FormDataEntryValue | null): number {
  return Math.max(0, Math.trunc(Number(raw) || 0));
}

const NOT_SCHEDULABLE_MESSAGE =
  "Visits can be added once a patient is pre-screened, screened, consented or enrolled.";

/** Adds one visit to a patient's program — a protocol visit type from the
 * study's visit schedule (which links it to that type's checklist, like an
 * auto-generated visit) or a custom-named one-off. */
export async function addVisit(formData: FormData): Promise<{ id: string }> {
  const ctx = await requireTenantContext();

  const subjectId = String(formData.get("subjectId") ?? "");
  const templateId = String(formData.get("templateId") ?? "") || null;
  const customName = String(formData.get("customName") ?? "").trim();
  const targetDate = parseDateOnly(String(formData.get("targetDate") ?? ""));
  const windowBefore = wholeDays(formData.get("windowBeforeDays"));
  const windowAfter = wholeDays(formData.get("windowAfterDays"));

  if (!subjectId) throw new Error("Pick a patient.");

  const id = await withTenantContext(ctx, async (tx) => {
    const subject = await tx.subject.findUniqueOrThrow({ where: { id: subjectId } });
    if (!canScheduleVisits(subject.status)) throw new Error(NOT_SCHEDULABLE_MESSAGE);

    let visitType = customName;
    if (templateId) {
      const template = await tx.visitScheduleTemplate.findUniqueOrThrow({ where: { id: templateId } });
      if (template.studyId !== subject.studyId) throw new Error("That visit type belongs to a different study.");
      const alreadyScheduled = await tx.visit.count({ where: { subjectId, templateId } });
      if (alreadyScheduled > 0) {
        throw new Error(`${template.name} is already on this patient's schedule — reschedule it instead.`);
      }
      visitType = template.name;
    }
    if (!visitType) throw new Error("Pick a visit type, or type a name for a custom visit.");

    const visit = await tx.visit.create({
      data: {
        organizationId: subject.organizationId,
        subjectId,
        studyId: subject.studyId,
        templateId,
        visitType,
        targetDate,
        windowStart: new Date(targetDate.getTime() - windowBefore * DAY_MS),
        windowEnd: new Date(targetDate.getTime() + windowAfter * DAY_MS),
        status: "SCHEDULED",
      },
    });
    return visit.id;
  });

  refresh();
  revalidatePath(`/dashboard/subjects/${subjectId}`);
  return { id };
}

/** Fills in every protocol visit the patient doesn't have yet, dated from
 * the given Day 0 (Baseline) date using the study's visit schedule offsets. */
export async function generateProtocolSchedule(
  subjectId: string,
  anchorDateRaw: string,
): Promise<{ created: number }> {
  const ctx = await requireTenantContext();
  const anchorDate = parseDateOnly(anchorDateRaw);

  const created = await withTenantContext(ctx, async (tx) => {
    const subject = await tx.subject.findUniqueOrThrow({ where: { id: subjectId } });
    if (!canScheduleVisits(subject.status)) throw new Error(NOT_SCHEDULABLE_MESSAGE);

    const templateCount = await tx.visitScheduleTemplate.count({ where: { studyId: subject.studyId } });
    if (templateCount === 0) {
      throw new Error("This study has no visit schedule yet — add visit types under Studies → Visit schedule first.");
    }

    return generateMissingVisitsForSubject(tx, {
      subjectId,
      studyId: subject.studyId,
      organizationId: subject.organizationId,
      anchorDate,
    });
  });

  refresh();
  revalidatePath(`/dashboard/subjects/${subjectId}`);
  return { created };
}

/** Removes a visit added by mistake. Not for completed visits (that's a real
 * record — mark it missed or leave it), and not while documents are attached
 * to it. Kits linked to it are detached by the FK; its checklist rows go
 * with it. */
export async function deleteVisit(visitId: string) {
  const ctx = await requireTenantContext();

  const subjectId = await withTenantContext(ctx, async (tx) => {
    const visit = await tx.visit.findUniqueOrThrow({ where: { id: visitId } });
    if (visit.status === "COMPLETED") throw new Error("Completed visits can't be removed.");
    const documents = await tx.document.count({ where: { visitId } });
    if (documents > 0) throw new Error("This visit has documents attached — remove or move them first.");

    await tx.visitChecklistResult.deleteMany({ where: { visitId } });
    await tx.visit.delete({ where: { id: visitId } });
    return visit.subjectId;
  });

  refresh();
  revalidatePath(`/dashboard/subjects/${subjectId}`);
  redirect(`/dashboard/subjects/${subjectId}`);
}

export async function markVisitCompleted(visitId: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) =>
    tx.visit.update({
      where: { id: visitId },
      data: { status: "COMPLETED", actualDate: new Date() },
    }),
  );
  refresh();
}

export async function markVisitMissed(visitId: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) =>
    tx.visit.update({ where: { id: visitId }, data: { status: "MISSED" } }),
  );
  refresh();
}

export async function rescheduleVisit(visitId: string, newTargetDate: string) {
  const ctx = await requireTenantContext();
  const targetDate = new Date(newTargetDate);
  if (Number.isNaN(targetDate.getTime())) {
    throw new Error("Invalid date");
  }

  await withTenantContext(ctx, async (tx) => {
    const visit = await tx.visit.findUniqueOrThrow({ where: { id: visitId } });
    const shiftDays =
      (targetDate.getTime() - visit.targetDate.getTime()) / (24 * 60 * 60 * 1000);
    const windowStart = new Date(visit.windowStart.getTime() + shiftDays * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(visit.windowEnd.getTime() + shiftDays * 24 * 60 * 60 * 1000);

    await tx.visit.update({
      where: { id: visitId },
      data: { status: "RESCHEDULED", targetDate, windowStart, windowEnd },
    });
  });
  refresh();
}
