"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import type { VisitStatus } from "@prisma/client";
import { generateMissingVisitsForSubject } from "@/lib/visit-generation";
import { canScheduleVisits, DAY_MS, parseDateOnly, wholeDays } from "@/lib/visit-scheduling";
import { setStudyPiAndSite } from "@/lib/study-details";
import { pickProtocolDocument } from "@/lib/protocol-document";

function refresh() {
  revalidatePath("/dashboard/visits");
  revalidatePath("/dashboard");
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

const VISIT_STATUSES: VisitStatus[] = ["SCHEDULED", "COMPLETED", "MISSED", "RESCHEDULED"];

/** Edits a visit after it's been made: date, window, actual date, status,
 * and — for a custom-named visit only — its name. A visit made from a
 * protocol visit type keeps that type's name (it's what ties it to the type's
 * checklist); change the type by removing the visit and adding another. */
export async function updateVisit(visitId: string, formData: FormData) {
  const ctx = await requireTenantContext();

  const targetDate = parseDateOnly(String(formData.get("targetDate") ?? ""));
  const windowBefore = wholeDays(formData.get("windowBeforeDays"));
  const windowAfter = wholeDays(formData.get("windowAfterDays"));
  const actualRaw = String(formData.get("actualDate") ?? "");
  const actualDate = actualRaw ? parseDateOnly(actualRaw) : null;
  let status = String(formData.get("status") ?? "") as VisitStatus;
  const customName = String(formData.get("visitType") ?? "").trim();

  if (!VISIT_STATUSES.includes(status)) throw new Error("Pick a valid status.");
  if (actualDate && status === "MISSED") {
    throw new Error("A missed visit can't have an actual date — clear it, or mark the visit Completed.");
  }
  // Entering the date it actually happened is what makes it Completed.
  if (actualDate && status !== "COMPLETED") status = "COMPLETED";
  if (status === "COMPLETED" && !actualDate) {
    throw new Error("Enter the actual date for a completed visit.");
  }

  const subjectId = await withTenantContext(ctx, async (tx) => {
    const visit = await tx.visit.findUniqueOrThrow({ where: { id: visitId } });

    let visitType = visit.visitType;
    if (!visit.templateId) {
      if (!customName) throw new Error("Visit name is required.");
      visitType = customName;
    }

    const dateChanged = visit.targetDate.getTime() !== targetDate.getTime();
    await tx.visit.update({
      where: { id: visitId },
      data: {
        visitType,
        targetDate,
        windowStart: new Date(targetDate.getTime() - windowBefore * DAY_MS),
        windowEnd: new Date(targetDate.getTime() + windowAfter * DAY_MS),
        actualDate,
        status,
        // A moved visit is due a fresh reminder.
        reminderSentAt: dateChanged ? null : visit.reminderSentAt,
      },
    });
    return visit.subjectId;
  });

  refresh();
  revalidatePath(`/dashboard/visits/${visitId}`);
  revalidatePath(`/dashboard/subjects/${subjectId}`);
  // Kits offered for removal depend on whether the visit has an actual date.
  revalidatePath("/dashboard/kits");
}

/** Saves the details printed on a visit's checklist document, each to where
 * it actually lives: PI name and site number on the study, protocol version
 * and release date on the study's protocol document, and the "(V3)" label and
 * footnote on the visit type's checklist. Fields left out of the form (because
 * they don't apply — e.g. no protocol document yet, or a custom visit with no
 * checklist) are skipped, not blanked. */
export async function updateVisitDocumentDetails(visitId: string, formData: FormData) {
  const ctx = await requireTenantContext();

  const text = (name: string) => String(formData.get(name) ?? "").trim();

  await withTenantContext(ctx, async (tx) => {
    const visit = await tx.visit.findUniqueOrThrow({ where: { id: visitId } });

    await setStudyPiAndSite(tx, visit.studyId, text("piName") || null, text("siteNumber") || null);

    if (formData.has("protocolVersion") || formData.has("protocolReleaseDate")) {
      const docs = await tx.document.findMany({ where: { studyId: visit.studyId, type: "PROTOCOL" } });
      const protocol = pickProtocolDocument(docs);
      if (!protocol) {
        throw new Error("This study has no protocol document yet — add one under Documents first.");
      }
      const version = text("protocolVersion");
      const releaseRaw = text("protocolReleaseDate");
      await tx.document.update({
        where: { id: protocol.doc.id },
        data: {
          // Version is required on a document, so a blank leaves it as is.
          version: version || protocol.doc.version,
          releaseDate: releaseRaw ? parseDateOnly(releaseRaw) : null,
        },
      });
    }

    if (visit.templateId && (formData.has("checklistVersion") || formData.has("checklistFootnote"))) {
      await tx.visitScheduleTemplate.update({
        where: { id: visit.templateId },
        data: {
          checklistVersion: text("checklistVersion") || null,
          checklistFootnote: text("checklistFootnote") || null,
        },
      });
    }
  });

  refresh();
  revalidatePath(`/dashboard/visits/${visitId}`);
  revalidatePath("/dashboard/documents");
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
