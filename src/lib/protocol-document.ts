import type { DocumentStatus } from "@prisma/client";
import { getDocumentDisplayStatus } from "@/lib/document-status";

type ProtocolDocCandidate = {
  id: string;
  title: string;
  version: string;
  releaseDate: Date | null;
  status: DocumentStatus;
  expiryDate: Date | null;
  signedAt: Date | null;
  createdAt: Date;
};

/**
 * The protocol document whose version and release date get printed on a
 * study's checklist documents. Prefers the newest ACTIVE one (signed, not
 * expired). If none is active yet — typically an amendment that's been
 * uploaded but is still waiting for the PI's signature — falls back to the
 * newest PENDING one, so a freshly uploaded amendment shows up on documents
 * straight away instead of the header going blank until it's signed. Expired
 * and superseded versions are never used.
 */
export function pickProtocolDocument<T extends ProtocolDocCandidate>(
  docs: T[],
): { doc: T; awaitingSignature: boolean } | null {
  const newestFirst = [...docs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const active = newestFirst.find((d) => getDocumentDisplayStatus(d) === "ACTIVE");
  if (active) return { doc: active, awaitingSignature: false };
  const pending = newestFirst.find((d) => getDocumentDisplayStatus(d) === "PENDING");
  if (pending) return { doc: pending, awaitingSignature: true };
  return null;
}
