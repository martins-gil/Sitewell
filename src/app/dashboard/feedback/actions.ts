"use server";

import { revalidatePath } from "next/cache";
import type { FeedbackArea } from "@prisma/client";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";

export async function submitFeedback(formData: FormData) {
  const ctx = await requireTenantContext();

  const area = String(formData.get("area") ?? "") as FeedbackArea;
  const confusing = String(formData.get("confusing") ?? "").trim() || null;
  const broken = String(formData.get("broken") ?? "").trim() || null;
  const suggestion = String(formData.get("suggestion") ?? "").trim() || null;
  const easeOfUseRating = Number(formData.get("easeOfUseRating"));

  if (!area || Number.isNaN(easeOfUseRating) || easeOfUseRating < 1 || easeOfUseRating > 5) {
    throw new Error("Area and an ease-of-use rating (1-5) are required.");
  }
  if (!ctx.organizationId) {
    throw new Error("Platform Admin accounts aren't attached to an organization and can't submit feedback.");
  }

  await withTenantContext(ctx, (tx) =>
    tx.feedbackSubmission.create({
      data: {
        organizationId: ctx.organizationId as string,
        submittedById: ctx.userId,
        area,
        confusing,
        broken,
        suggestion,
        easeOfUseRating,
      },
    }),
  );

  revalidatePath("/dashboard/feedback");
}
