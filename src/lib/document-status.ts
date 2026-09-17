import type { DocumentStatus } from "@prisma/client";

/**
 * The status shown to users is computed from real state (expiry date, sign-
 * off) rather than a manually-maintained field, so it's always accurate
 * without anyone having to remember to flip it. The one stored value that
 * still matters is SUPERSEDED — set automatically when a newer version is
 * uploaded (see documents/actions.ts) — which stays visible on old versions
 * so version history doesn't quietly disappear.
 */
export type DocumentDisplayStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "SUPERSEDED";

export function getDocumentDisplayStatus(doc: {
  status: DocumentStatus;
  expiryDate: Date | null;
  signedAt: Date | null;
}): DocumentDisplayStatus {
  if (doc.status === "SUPERSEDED") return "SUPERSEDED";
  if (doc.expiryDate && doc.expiryDate.getTime() < Date.now()) return "EXPIRED";
  if (!doc.signedAt) return "PENDING";
  return "ACTIVE";
}
