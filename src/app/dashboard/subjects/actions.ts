"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { DAY_MS, parseDateOnly, wholeDays } from "@/lib/visit-scheduling";

// One row of the visit list the Add-Patient form sends when copying from
// another patient — already edited (dates, windows, rows left out) by the
// coordinator. Validated here rather than trusted.
const visitPlanSchema = z
  .array(
    z.object({
      templateId: z.string().nullable(),
      visitType: z.string(),
      targetDate: z.string(),
      windowBeforeDays: z.number(),
      windowAfterDays: z.number(),
    }),
  )
  .max(60);

export async function addSubject(formData: FormData) {
  const ctx = await requireTenantContext();

  const studyId = String(formData.get("studyId") ?? "");
  const subjectCodeOverride = String(formData.get("subjectCode") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const duplicateFromSubjectId = String(formData.get("duplicateFromSubjectId") ?? "").trim() || null;
  const copyCriteria = formData.get("copyCriteria") === "on";

  if (!studyId) throw new Error("Study is required.");

  let plan: z.infer<typeof visitPlanSchema> = [];
  const planRaw = String(formData.get("visitPlan") ?? "");
  if (planRaw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(planRaw);
    } catch {
      parsed = null;
    }
    const result = visitPlanSchema.safeParse(parsed);
    if (!result.success) throw new Error("Couldn't read the visit list — reload the page and try again.");
    plan = result.data;
  }

  const subjectId = await withTenantContext(ctx, async (tx) => {
    const study = await tx.study.findUniqueOrThrow({ where: { id: studyId } });

    // Restricted to the same study server-side regardless of what the form
    // offered.
    const source = duplicateFromSubjectId
      ? await tx.subject.findFirst({ where: { id: duplicateFromSubjectId, studyId } })
      : null;
    if (duplicateFromSubjectId && !source) {
      throw new Error("Pick a patient from the same study to copy from.");
    }

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

    // Copying eligibility criteria carries over the LIST (the criterion text)
    // but not the source patient's answers: each one starts as `met: null`
    // ("not assessed"), because whether this new patient meets a criterion
    // is for someone to decide — silently inheriting another patient's ✓
    // would record an assessment nobody made.
    let criteria: { criterion: string; met: null; type: "I" | "E" }[] =
      source && copyCriteria
        ? ((source.ieCriteriaSnapshot as { criterion: string; type?: "I" | "E" }[] | null) ?? []).map((c) => ({
            criterion: c.criterion,
            met: null,
            type: c.type === "E" ? "E" : "I",
          }))
        : [];
    // A new patient (not copied from another) starts from the study's own
    // criteria, if it has any — each one "not assessed".
    if (!source) {
      const fromStudy = study.ieCriteria as { inclusion?: string[]; exclusion?: string[] } | null;
      criteria = [
        ...(fromStudy?.inclusion ?? []).map((criterion) => ({ criterion, met: null, type: "I" as const })),
        ...(fromStudy?.exclusion ?? []).map((criterion) => ({ criterion, met: null, type: "E" as const })),
      ];
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
        ...(criteria.length > 0 ? { ieCriteriaSnapshot: criteria } : {}),
      },
    });

    // Visits copied from another patient's schedule, as edited in the form:
    // the shape (type, and the link to a protocol visit type) plus whatever
    // dates/windows the coordinator set for THIS patient. Not the source's
    // status/actualDate history, checklist results, kits or documents — those
    // belong to what happened at the source patient's visits.
    if (source && plan.length > 0) {
      const templates = await tx.visitScheduleTemplate.findMany({ where: { studyId } });
      const templateById = new Map(templates.map((t) => [t.id, t]));

      await tx.visit.createMany({
        data: plan.map((row) => {
          let visitType = row.visitType.trim();
          if (row.templateId) {
            const template = templateById.get(row.templateId);
            if (!template) throw new Error("A copied visit refers to a visit type from a different study.");
            visitType = template.name;
          }
          if (!visitType) throw new Error("Every copied visit needs a name.");

          const targetDate = parseDateOnly(row.targetDate);
          return {
            organizationId: study.organizationId,
            subjectId: subject.id,
            studyId,
            templateId: row.templateId,
            visitType,
            targetDate,
            windowStart: new Date(targetDate.getTime() - wholeDays(row.windowBeforeDays) * DAY_MS),
            windowEnd: new Date(targetDate.getTime() + wholeDays(row.windowAfterDays) * DAY_MS),
            status: "SCHEDULED" as const,
          };
        }),
      });
    }

    return subject.id;
  });

  revalidatePath("/dashboard/subjects");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/visits");
  redirect(`/dashboard/subjects/${subjectId}`);
}
