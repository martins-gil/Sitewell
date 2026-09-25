import { createHmac, timingSafeEqual } from "node:crypto";
import type { TenantContext } from "@/lib/db-context";

// The afternoon "were today's samples shipped?" e-mail (src/lib/sample-confirm-emails.ts):
// like a meeting invite's Yes/No, the two links work with no login, so — same shape as the
// calendar feed token (src/lib/calendar-feed.ts) — the link's own signed token is the
// credential. Nothing secret is stored: it carries the shipment and its organization, signed
// with AUTH_SECRET, so a route can build a tenant context scoped to exactly that
// organization (never the owner client, never a platform-wide bypass) without a login.

const SEP = ".";

function secret(): string | null {
  return process.env.AUTH_SECRET || null;
}

function sign(payload: string): string | null {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update(`sample-confirm:${payload}`).digest("base64url");
}

export function makeConfirmToken(shipmentId: string, organizationId: string): string | null {
  const payload = [shipmentId, organizationId].join(SEP);
  const signature = sign(payload);
  return signature ? `${payload}${SEP}${signature}` : null;
}

export type ConfirmTokenParts = { shipmentId: string; organizationId: string };

/** The parts of a confirmation token, only if its signature is genuine. */
export function readConfirmToken(token: string): ConfirmTokenParts | null {
  const parts = token.split(SEP);
  if (parts.length !== 3) return null;
  const [shipmentId, organizationId, signature] = parts;
  if (!shipmentId || !organizationId) return null;

  const expected = sign([shipmentId, organizationId].join(SEP));
  if (!expected) return null;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { shipmentId, organizationId };
}

/** A tenant context scoped to exactly the token's organization — like the calendar feed
 * route, never platform-wide, and never the owner client. RLS still enforces that the
 * shipment being touched actually belongs to this organization. */
export function sampleConfirmContext(parts: ConfirmTokenParts): TenantContext {
  return {
    userId: `public:sample-confirm:${parts.shipmentId}`,
    organizationId: parts.organizationId,
    isPlatformAdmin: false,
    role: "SAMPLE_CONFIRM",
  };
}
