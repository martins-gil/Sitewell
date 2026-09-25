"use server";

import { withTenantContext } from "@/lib/db-context";
import { readConfirmToken, sampleConfirmContext } from "@/lib/sample-confirm";
import { clientIp } from "@/lib/app-url";
import { tooBusy } from "@/lib/throttle";

export type ConfirmProblem = "INVALID_LINK" | "MISSING_REASON" | "TOO_MANY";
export type ConfirmResult =
  | { ok: true; confirmedShipped: boolean; confirmedAt: string; notShippedReason: string | null }
  | { ok: false; problem: ConfirmProblem };

/** "Yes, they were shipped." A thrown error would reach the browser as a masked "Server
 * Components render" message in production, so this always returns a result. */
export async function confirmShipped(token: string): Promise<ConfirmResult> {
  if (tooBusy(`sample-confirm-ip:${await clientIp()}`, 20)) return { ok: false, problem: "TOO_MANY" };
  const parts = readConfirmToken(token);
  if (!parts) return { ok: false, problem: "INVALID_LINK" };

  const confirmedAt = new Date();
  const updated = await withTenantContext(sampleConfirmContext(parts), (tx) =>
    // RLS (organization_id = the token's org) is what actually stops a shipment of another
    // organization being touched here, whatever the WHERE clause says.
    tx.labShipment.updateMany({
      where: { id: parts.shipmentId },
      data: { confirmedShipped: true, confirmedAt, notShippedReason: null },
    }),
  );
  if (updated.count !== 1) return { ok: false, problem: "INVALID_LINK" };
  return { ok: true, confirmedShipped: true, confirmedAt: confirmedAt.toISOString(), notShippedReason: null };
}

/** "No, they weren't" — with the reason typed in the box the page opens. */
export async function declineShipped(token: string, reason: string): Promise<ConfirmResult> {
  if (tooBusy(`sample-confirm-ip:${await clientIp()}`, 20)) return { ok: false, problem: "TOO_MANY" };
  const parts = readConfirmToken(token);
  if (!parts) return { ok: false, problem: "INVALID_LINK" };
  const clean = reason.trim().slice(0, 1000);
  if (!clean) return { ok: false, problem: "MISSING_REASON" };

  const confirmedAt = new Date();
  const updated = await withTenantContext(sampleConfirmContext(parts), (tx) =>
    tx.labShipment.updateMany({
      where: { id: parts.shipmentId },
      data: { confirmedShipped: false, confirmedAt, notShippedReason: clean },
    }),
  );
  if (updated.count !== 1) return { ok: false, problem: "INVALID_LINK" };
  return { ok: true, confirmedShipped: false, confirmedAt: confirmedAt.toISOString(), notShippedReason: clean };
}
