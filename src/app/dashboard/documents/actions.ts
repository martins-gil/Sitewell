"use server";

import { revalidatePath } from "next/cache";
import type { DocumentType } from "@prisma/client";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { saveUploadedFile } from "@/lib/storage";

export async function uploadDocument(formData: FormData) {
  const ctx = await requireTenantContext();

  const studyId = String(formData.get("studyId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "") || null;
  const visitId = String(formData.get("visitId") ?? "") || null;
  const type = String(formData.get("type") ?? "") as DocumentType;
  const title = String(formData.get("title") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim();
  const expiryDateRaw = String(formData.get("expiryDate") ?? "");
  const expiryDate = expiryDateRaw ? new Date(expiryDateRaw) : null;
  const releaseDateRaw = String(formData.get("releaseDate") ?? "");
  const releaseDate = releaseDateRaw ? new Date(releaseDateRaw) : null;
  const file = formData.get("file");

  if (!studyId || !type || !title || !version || !(file instanceof File) || file.size === 0) {
    throw new Error("Study, type, title, version, and a file are all required.");
  }

  await withTenantContext(ctx, async (tx) => {
    const study = await tx.study.findUniqueOrThrow({ where: { id: studyId } });
    const { relativePath } = await saveUploadedFile(study.organizationId, file);

    // Versioning: uploading a document with the same study/subject/visit/type/
    // title as an existing ACTIVE one supersedes it rather than creating an
    // unrelated duplicate row.
    await tx.document.updateMany({
      where: { studyId, subjectId, visitId, type, title, status: "ACTIVE" },
      data: { status: "SUPERSEDED" },
    });

    await tx.document.create({
      data: {
        organizationId: study.organizationId,
        studyId,
        subjectId,
        visitId,
        type,
        title,
        version,
        fileUrl: relativePath,
        releaseDate,
        expiryDate,
        status: "ACTIVE",
      },
    });
  });

  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard");
  if (visitId) revalidatePath(`/dashboard/visits/${visitId}`);
}

// Fix a document's version label or release date after the fact — the
// protocol document's version and release date are what get printed on the
// checklist documents, so a typo here shows up there. Every change is
// recorded by the audit trigger like any other update.
export async function updateDocumentDetails(documentId: string, formData: FormData) {
  const ctx = await requireTenantContext();

  const version = String(formData.get("version") ?? "").trim();
  const releaseRaw = String(formData.get("releaseDate") ?? "");
  if (!version) throw new Error("Version is required.");

  await withTenantContext(ctx, (tx) =>
    tx.document.update({
      where: { id: documentId },
      data: { version, releaseDate: releaseRaw ? new Date(releaseRaw) : null },
    }),
  );

  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/visits/[id]", "page");
}

// Stands in for a real 21 CFR Part 11 e-signature (Phase 5) — records who
// signed and when, backed by the append-only audit_log trigger.
export async function signDocument(documentId: string) {
  const ctx = await requireTenantContext();

  if (ctx.role !== "PI" && ctx.role !== "ORG_ADMIN" && !ctx.isPlatformAdmin) {
    throw new Error("Only a PI or Org Admin can sign documents.");
  }

  await withTenantContext(ctx, (tx) =>
    tx.document.update({
      where: { id: documentId },
      data: { signedById: ctx.userId, signedAt: new Date() },
    }),
  );

  revalidatePath("/dashboard/documents");
}
