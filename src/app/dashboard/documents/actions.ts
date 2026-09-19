"use server";

import { revalidatePath } from "next/cache";
import type { DocumentType, Prisma } from "@prisma/client";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { saveUploadedFile } from "@/lib/storage";
import { parseDisplayStatus, toStoredStatus, type DocumentDisplayStatus } from "@/lib/document-status";

const STORAGE_UNAVAILABLE =
  "The file couldn't be saved — file storage isn't set up on this site yet. Leave the file empty to log the document without one.";

// A file is optional: a document can be logged (title, type, version, dates)
// with nothing attached and get a file later (attachDocumentFile). Returns null
// when no file was chosen.
async function saveOptionalFile(organizationId: string, file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return null;
  try {
    return (await saveUploadedFile(organizationId, file)).relativePath;
  } catch {
    throw new Error(STORAGE_UNAVAILABLE);
  }
}

// "Active" with an expiry date that has already passed would just be shown as
// Expired (see getDocumentDisplayStatus) — better to say so than to accept a
// choice that silently doesn't stick.
function assertCanBeActive(status: DocumentDisplayStatus, expiryDate: Date | null) {
  if (status === "ACTIVE" && expiryDate && expiryDate.getTime() < Date.now()) {
    throw new Error("Its expiry date has already passed — change the expiry date first, or choose Expired.");
  }
}

// Versioning: when a document becomes ACTIVE, any older ACTIVE document with
// the same study/subject/visit/type/title is superseded rather than left as an
// unrelated duplicate in force. Done when a document BECOMES active (added as
// active, signed, or set to Active) — not when it's merely added as Pending,
// so a draft amendment doesn't retire the version that's actually in force.
async function supersedeOlderVersions(
  tx: Prisma.TransactionClient,
  doc: {
    id: string;
    studyId: string;
    subjectId: string | null;
    visitId: string | null;
    type: DocumentType;
    typeLabel: string | null;
    title: string;
  },
) {
  await tx.document.updateMany({
    where: {
      studyId: doc.studyId,
      subjectId: doc.subjectId,
      visitId: doc.visitId,
      type: doc.type,
      // Two "Other" documents with different type names are different kinds of document.
      typeLabel: doc.typeLabel,
      title: doc.title,
      status: "ACTIVE",
      id: { not: doc.id },
    },
    data: { status: "SUPERSEDED" },
  });
}

function refreshDocuments(visitId?: string | null) {
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/visits/[id]", "page");
  if (visitId) revalidatePath(`/dashboard/visits/${visitId}`);
}

export async function uploadDocument(formData: FormData) {
  const ctx = await requireTenantContext();

  const studyId = String(formData.get("studyId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "") || null;
  const visitId = String(formData.get("visitId") ?? "") || null;
  const type = String(formData.get("type") ?? "") as DocumentType;
  // "Other" can be given a name of its own (e.g. "Lab certificate").
  const typeLabel = type === "OTHER" ? String(formData.get("typeLabel") ?? "").trim().slice(0, 80) || null : null;
  const title = String(formData.get("title") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim();
  const expiryDateRaw = String(formData.get("expiryDate") ?? "");
  const expiryDate = expiryDateRaw ? new Date(expiryDateRaw) : null;
  const releaseDateRaw = String(formData.get("releaseDate") ?? "");
  const releaseDate = releaseDateRaw ? new Date(releaseDateRaw) : null;
  const status = parseDisplayStatus(String(formData.get("status") ?? "ACTIVE"));
  const file = formData.get("file");

  if (!studyId || !type || !title || !version) {
    throw new Error("Study, type, title and version are required.");
  }
  if (!status) throw new Error("Pick a valid status.");
  assertCanBeActive(status, expiryDate);

  await withTenantContext(ctx, async (tx) => {
    const study = await tx.study.findUniqueOrThrow({ where: { id: studyId } });
    const relativePath = await saveOptionalFile(study.organizationId, file);

    const created = await tx.document.create({
      data: {
        organizationId: study.organizationId,
        studyId,
        subjectId,
        visitId,
        type,
        typeLabel,
        title,
        version,
        fileUrl: relativePath,
        releaseDate,
        expiryDate,
        status: toStoredStatus(status),
      },
    });

    if (status === "ACTIVE") await supersedeOlderVersions(tx, created);
  });

  refreshDocuments(visitId);
}

// Changes a document's status by hand — e.g. marking it Active as soon as it's
// added, or Expired/Superseded for a historical one. Every change is recorded
// by the audit trigger like any other update.
export async function setDocumentStatus(documentId: string, requested: DocumentDisplayStatus) {
  const ctx = await requireTenantContext();
  const status = parseDisplayStatus(requested);
  if (!status) throw new Error("Pick a valid status.");

  const visitId = await withTenantContext(ctx, async (tx) => {
    const doc = await tx.document.findUniqueOrThrow({ where: { id: documentId } });
    assertCanBeActive(status, doc.expiryDate);

    await tx.document.update({ where: { id: documentId }, data: { status: toStoredStatus(status) } });
    if (status === "ACTIVE") await supersedeOlderVersions(tx, doc);
    return doc.visitId;
  });

  refreshDocuments(visitId);
}

// Attach (or replace) the file on a document that was logged without one.
export async function attachDocumentFile(documentId: string, formData: FormData) {
  const ctx = await requireTenantContext();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to attach.");

  await withTenantContext(ctx, async (tx) => {
    const document = await tx.document.findUniqueOrThrow({ where: { id: documentId } });
    const relativePath = await saveOptionalFile(document.organizationId, file);
    await tx.document.update({ where: { id: documentId }, data: { fileUrl: relativePath } });
  });

  refreshDocuments();
}

// Fix a document's version label, release date or expiry date after the fact
// — the protocol document's version and release date are what get printed on
// the checklist documents, so a typo here shows up there. Every change is
// recorded by the audit trigger like any other update.
export async function updateDocumentDetails(documentId: string, formData: FormData) {
  const ctx = await requireTenantContext();

  const version = String(formData.get("version") ?? "").trim();
  const releaseRaw = String(formData.get("releaseDate") ?? "");
  const expiryRaw = String(formData.get("expiryDate") ?? "");
  if (!version) throw new Error("Version is required.");

  await withTenantContext(ctx, async (tx) => {
    const doc = await tx.document.findUniqueOrThrow({ where: { id: documentId }, select: { type: true } });
    await tx.document.update({
      where: { id: documentId },
      data: {
        version,
        releaseDate: releaseRaw ? new Date(releaseRaw) : null,
        expiryDate: expiryRaw ? new Date(expiryRaw) : null,
        // Only an "Other" document has a type name of its own to edit.
        ...(doc.type === "OTHER" && formData.has("typeLabel")
          ? { typeLabel: String(formData.get("typeLabel") ?? "").trim().slice(0, 80) || null }
          : {}),
      },
    });
  });

  refreshDocuments();
}

// Stands in for a real 21 CFR Part 11 e-signature (Phase 5) — records who
// signed and when, backed by the append-only audit_log trigger. Signing a
// Pending document is what makes it Active.
export async function signDocument(documentId: string) {
  const ctx = await requireTenantContext();

  if (ctx.role !== "PI" && ctx.role !== "ORG_ADMIN" && !ctx.isPlatformAdmin) {
    throw new Error("Only a PI or Org Admin can sign documents.");
  }

  const visitId = await withTenantContext(ctx, async (tx) => {
    const doc = await tx.document.findUniqueOrThrow({ where: { id: documentId } });
    const activates = doc.status === "DRAFT";

    await tx.document.update({
      where: { id: documentId },
      data: { signedById: ctx.userId, signedAt: new Date(), ...(activates ? { status: "ACTIVE" } : {}) },
    });
    if (activates) await supersedeOlderVersions(tx, doc);
    return doc.visitId;
  });

  refreshDocuments(visitId);
}
