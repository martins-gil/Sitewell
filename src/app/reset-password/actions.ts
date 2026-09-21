"use server";

import { clientIp } from "@/lib/app-url";
import { completePasswordReset, type ResetResult } from "@/lib/password-reset";
import { tooBusy } from "@/lib/throttle";

/** Sets the new password for the account a reset link belongs to. Returns the outcome, never throws. */
export async function resetPassword(token: string, newPassword: string): Promise<ResetResult | { ok: false; problem: "TOO_MANY" }> {
  // Guessing tokens is hopeless (256 random bits), but there is no reason to allow hammering.
  if (tooBusy(`reset-ip:${await clientIp()}`, 10)) return { ok: false, problem: "TOO_MANY" };
  return completePasswordReset(token, newPassword);
}
