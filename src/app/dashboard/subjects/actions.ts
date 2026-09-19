"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";

export async function addSubject(formData: FormData) {
  const ctx = await requireTenantContext();

  const studyId = String(formData.get("studyId") ?? "");
  const subjectCodeOverride = String(formData.get("subjectCode") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const duplicateFromSubjectId = String(formData.get("duplicateFromSubjectId") ?? "").trim() || null;

  if (!studyId) throw new Error("Study is required.");

  const subjectId = await withTenantContext(ctx, async (tx) => {
    const study = await tx.study.findUniqueOrThrow({ where: { id: studyId } });

    let subjectCode = subjectCodeOverride;
    if (!subjectCode) {
      const existing = await tx.subject.findMany({
        where: { studyId },
        select: { subjectCode: true },
      });
      const prefix = `${study.protocolId}-`;
      const maxN = existing.reduce((max, s) => {
        if (!s.subjectCode.startsWith(prefix)) return max;
        const n = Number(s.subjectCode.slice(prefix.length));
        return Number.isFinite(n) && n > max ? n : max;
      }, 0);
      subjectCode = `${prefix}${String(maxN + 1).padStart(4, "0")}`;
    }

    // is_test_data is always true here, deliberately, with no form control
    // to override it — PROJECT_SPEC.md's guardrail is no real subject data
    // before Phase 5, and this is the only path that creates a Subject row.
    const subject = await tx.subject.create({
      data: {
        organizationId: study.organizationId,
        studyId,
        subjectCode,
        status: "IDENTIFIED",
        displayName,
        isTestData: true,
      },
    });

    // Optionally duplicate another subject's visit list (same visit types,
    // same dates) as a starting point for this new recruitment in the same
    // trial — for a site that wants to hand-schedule the new patient's
    // visits instead of waiting for the enrollment-offset auto-generation
    // in src/lib/visit-generation.ts. Only the schedule shape is copied
    // (type/target date/window), reset to SCHEDULED — not the source
    // visit's own status/actualDate history, checklist results, or
    // documents, since those belong to what actually happened at the
    // source patient's visits, not this new one. The coordinator then
    // adjusts each date via the existing reschedule action. Restricted to
    // the same study server-side regardless of what the form offered.
    if (duplicateFromSubjectId) {
      const sourceVisits = await tx.visit.findMany({
        where: { subjectId: duplicateFromSubjectId, studyId },
        orderBy: { targetDate: "asc" },
      });
      if (sourceVisits.length > 0) {
        await tx.visit.createMany({
          data: sourceVisits.map((v) => ({
            organizationId: study.organizationId,
            subjectId: subject.id,
            studyId,
            templateId: v.templateId,
            visitType: v.visitType,
            targetDate: v.targetDate,
            windowStart: v.windowStart,
            windowEnd: v.windowEnd,
            status: "SCHEDULED" as const,
          })),
        });
      }
    }

    return subject.id;
  });

  revalidatePath("/dashboard/subjects");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/visits");
  redirect(`/dashboard/subjects/${subjectId}`);
}
