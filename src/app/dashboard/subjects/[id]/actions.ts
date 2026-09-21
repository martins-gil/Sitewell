"use server";

import { revalidatePath } from "next/cache";
import type { SubjectStatus } from "@prisma/client";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { generateVisitsForSubject } from "@/lib/visit-generation";

export async function updateSubjectStatus(subjectId: string, status: SubjectStatus) {
  const ctx = await requireTenantContext();

  await withTenantContext(ctx, async (tx) => {
    const subject = await tx.subject.findUniqueOrThrow({ where: { id: subjectId } });

    const isNewlyEnrolled = status === "ENROLLED" && subject.status !== "ENROLLED";
    const enrolledAt = isNewlyEnrolled ? new Date() : subject.enrolledAt;

    await tx.subject.update({
      where: { id: subjectId },
      data: { status, enrolledAt },
    });

    if (isNewlyEnrolled) {
      await generateVisitsForSubject(tx, {
        subjectId: subject.id,
        studyId: subject.studyId,
        organizationId: subject.organizationId,
        enrolledAt: enrolledAt as Date,
      });
    }
  });

  revalidatePath(`/dashboard/subjects/${subjectId}`);
  revalidatePath("/dashboard/subjects");
  revalidatePath("/dashboard/visits");
  revalidatePath("/dashboard");
}

// met: true = the patient meets the criterion AS WRITTEN, false = doesn't, null =
// not assessed yet (e.g. a criterion cloned from another patient's list — see
// addSubject). For an exclusion criterion, "meets it" is the bad answer.
// type: "I" inclusion / "E" exclusion; criteria saved before the split have none
// and are treated as inclusion.
type IeType = "I" | "E";
type IeCriterion = { criterion: string; met: boolean | null; type?: IeType };

const sameCriterion = (a: { criterion: string; type?: IeType }, b: { criterion: string; type?: IeType }) =>
  a.criterion.trim().toLowerCase() === b.criterion.trim().toLowerCase() && (a.type ?? "I") === (b.type ?? "I");

async function updateCriteria(subjectId: string, change: (list: IeCriterion[]) => IeCriterion[]) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, async (tx) => {
    const subject = await tx.subject.findUniqueOrThrow({
      where: { id: subjectId },
      select: { ieCriteriaSnapshot: true },
    });
    const existing = (subject.ieCriteriaSnapshot as IeCriterion[] | null) ?? [];
    await tx.subject.update({
      where: { id: subjectId },
      data: { ieCriteriaSnapshot: change(existing) },
    });
  });
  revalidatePath(`/dashboard/subjects/${subjectId}`);
  revalidatePath("/dashboard/subjects");
}

export async function setIeCriterionStatus(subjectId: string, index: number, met: boolean | null) {
  await updateCriteria(subjectId, (list) => {
    if (!list[index]) throw new Error("That criterion no longer exists — reload the page.");
    return list.map((c, i) => (i === index ? { ...c, met } : c));
  });
}

export async function removeIeCriterion(subjectId: string, index: number) {
  await updateCriteria(subjectId, (list) => {
    if (!list[index]) throw new Error("That criterion no longer exists — reload the page.");
    return list.filter((_, i) => i !== index);
  });
}

export async function addIeCriterion(subjectId: string, criterion: string, met: boolean | null, type: IeType = "I") {
  const ctx = await requireTenantContext();
  const trimmed = criterion.trim();
  if (!trimmed) throw new Error("Criterion text is required.");

  await withTenantContext(ctx, async (tx) => {
    const subject = await tx.subject.findUniqueOrThrow({
      where: { id: subjectId },
      select: { ieCriteriaSnapshot: true },
    });
    const existing = (subject.ieCriteriaSnapshot as IeCriterion[] | null) ?? [];
    const updated = [...existing, { criterion: trimmed, met, type }];

    await tx.subject.update({
      where: { id: subjectId },
      data: { ieCriteriaSnapshot: updated },
    });
  });

  revalidatePath(`/dashboard/subjects/${subjectId}`);
}

/** Adds a list of criteria (from pasted text, or the study's list) as "not
 * assessed", skipping any the patient already has (same text and group). */
async function addNotAssessed(subjectId: string, incoming: { criterion: string; type: IeType }[]) {
  const ctx = await requireTenantContext();
  const added = await withTenantContext(ctx, async (tx) => {
    const subject = await tx.subject.findUniqueOrThrow({
      where: { id: subjectId },
      select: { ieCriteriaSnapshot: true },
    });
    const existing = (subject.ieCriteriaSnapshot as IeCriterion[] | null) ?? [];
    const fresh = incoming
      .map((c) => ({ criterion: c.criterion.trim(), type: c.type }))
      .filter((c) => c.criterion && !existing.some((e) => sameCriterion(e, c)))
      .filter((c, i, all) => all.findIndex((o) => sameCriterion(o, c)) === i)
      .slice(0, 200);
    if (fresh.length > 0) {
      await tx.subject.update({
        where: { id: subjectId },
        data: { ieCriteriaSnapshot: [...existing, ...fresh.map((c) => ({ ...c, met: null }))] },
      });
    }
    return fresh.length;
  });
  revalidatePath(`/dashboard/subjects/${subjectId}`);
  return { added };
}

export async function addIeCriteriaBulk(subjectId: string, items: { criterion: string; type: IeType }[]) {
  return addNotAssessed(subjectId, items.filter((i) => i.type === "I" || i.type === "E"));
}

/** Copies the study's inclusion/exclusion list onto the patient. */
export async function loadStudyCriteria(subjectId: string) {
  const ctx = await requireTenantContext();
  const list = await withTenantContext(ctx, async (tx) => {
    const subject = await tx.subject.findUniqueOrThrow({
      where: { id: subjectId },
      select: { study: { select: { ieCriteria: true } } },
    });
    const value = subject.study.ieCriteria as { inclusion?: string[]; exclusion?: string[] } | null;
    return [
      ...(value?.inclusion ?? []).map((criterion) => ({ criterion, type: "I" as const })),
      ...(value?.exclusion ?? []).map((criterion) => ({ criterion, type: "E" as const })),
    ];
  });
  return addNotAssessed(subjectId, list);
}