"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";

export async function addSubject(formData: FormData) {
  const ctx = await requireTenantContext();

  const studyId = String(formData.get("studyId") ?? "");
  const subjectCodeOverride = String(formData.get("subjectCode") ?? "").trim();
  const referralSource = String(formData.get("referralSource") ?? "").trim() || null;

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
        referralSource,
        isTestData: true,
      },
    });
    return subject.id;
  });

  revalidatePath("/dashboard/subjects");
  revalidatePath("/dashboard");
  redirect(`/dashboard/subjects/${subjectId}`);
}
