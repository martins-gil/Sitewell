"use server";

import { after } from "next/server";
import { appOrigin, clientIp } from "@/lib/app-url";
import { passwordResetAvailable, sendPasswordResetLink } from "@/lib/password-reset";
import { tooBusy } from "@/lib/throttle";

export type ForgotResult =
  | { ok: true }
  | { ok: false; problem: "NOT_AVAILABLE" | "BAD_EMAIL" | "TOO_MANY" };

/**
 * "Send me a link to choose a new password." The answer is the same whether or
 * not the address has an account (so this can't be used to find out who does);
 * the email itself is sent after the answer has gone back.
 */
export async function requestPasswordReset(formData: FormData): Promise<ForgotResult> {
  // A hidden field real people never fill in: bots do.
  if (String(formData.get("website") ?? "") !== "") return { ok: true };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return { ok: false, problem: "BAD_EMAIL" };
  // Without an email service the link could never arrive — say so, rather than pretend.
  if (!passwordResetAvailable()) return { ok: false, problem: "NOT_AVAILABLE" };
  if (tooBusy(`forgot-ip:${await clientIp()}`, 5)) return { ok: false, problem: "TOO_MANY" };

  const origin = await appOrigin();
  after(async () => {
    try {
      await sendPasswordResetLink(email, origin);
    } catch (error) {
      console.error("[password-reset] could not send the link:", error instanceof Error ? error.message : error);
    }
  });
  return { ok: true };
}
