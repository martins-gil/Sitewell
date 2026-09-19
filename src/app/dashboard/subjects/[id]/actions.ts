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

export async function updateSubjectDisplayName(subjectId: string, displayName: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) =>
    tx.subject.update({ where: { id: subjectId }, data: { displayName: displayName.trim() || null } }),
  );
  revalidatePath(`/dashboard/subjects/${subjectId}`);
  revalidatePath("/dashboard/subjects");
}

// met: true = meets it, false = doesn't, null = not assessed yet (e.g. a
// criterion cloned from another patient's list — see addSubject).
type IeCriterion = { criterion: string; met: boolean | null };

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

export async function addIeCriterion(subjectId: string, criterion: string, met: boolean | null) {
  const ctx = await requireTenantContext();
  const trimmed = criterion.trim();
  if (!trimmed) throw new Error("Criterion text is required.");

  await withTenantContext(ctx, async (tx) => {
    const subject = await tx.subject.findUniqueOrThrow({
      where: { id: subjectId },
      select: { ieCriteriaSnapshot: true },
    });
    const existing = (subject.ieCriteriaSnapshot as IeCriterion[] | null) ?? [];
    const updated = [...existing, { criterion: trimmed, met }];

    await tx.subject.update({
      where: { id: subjectId },
      data: { ieCriteriaSnapshot: updated },
    });
  });

  revalidatePath(`/dashboard/subjects/${subjectId}`);
}
