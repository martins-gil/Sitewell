import type { DocumentStatus } from "@prisma/client";

/**
 * Document status is SET BY PEOPLE — chosen when a document is added and
 * changeable afterwards — and stored. What users see are four states:
 * Pending, Active, Expired, Superseded. The stored enum spells "Pending" as
 * DRAFT (that's the value the schema already had for it).
 *
 * Two things stay automatic, so nobody has to remember them:
 *  - an Active document whose expiry date has passed is shown as Expired;
 *  - adding/activating a newer version supersedes the older Active one (see
 *    supersedeOlderVersions in documents/actions.ts).
 */
export type DocumentDisplayStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "SUPERSEDED";

export const DOCUMENT_STATUS_CHOICES: DocumentDisplayStatus[] = ["PENDING", "ACTIVE", "EXPIRED", "SUPERSEDED"];

export function getDocumentDisplayStatus(doc: {
  status: DocumentStatus;
  expiryDate: Date | null;
}): DocumentDisplayStatus {
  if (doc.status === "SUPERSEDED") return "SUPERSEDED";
  if (doc.status === "EXPIRED") return "EXPIRED";
  if (doc.status === "DRAFT") return "PENDING";
  if (doc.expiryDate && doc.expiryDate.getTime() < Date.now()) return "EXPIRED";
  return "ACTIVE";
}

export function toStoredStatus(display: DocumentDisplayStatus): DocumentStatus {
  return display === "PENDING" ? "DRAFT" : display;
}

export function parseDisplayStatus(raw: string): DocumentDisplayStatus | null {
  return (DOCUMENT_STATUS_CHOICES as string[]).includes(raw) ? (raw as DocumentDisplayStatus) : null;
}
