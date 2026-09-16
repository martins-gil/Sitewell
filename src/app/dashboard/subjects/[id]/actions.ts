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
