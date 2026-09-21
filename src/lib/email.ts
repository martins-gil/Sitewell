import { Resend } from "resend";

const FROM_ADDRESS = process.env.EMAIL_FROM || "SiteWell-ct <onboarding@resend.dev>";

let resendClient: Resend | null = null;
function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

/** True when real email can be sent (a Resend key is set), false when it only goes to the log. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Sends real email when RESEND_API_KEY is set; otherwise logs to the
 * console. No account/API key has been configured in this environment, so
 * every reminder so far has gone through the console path — the Resend
 * path is written and ready, just unverified against a live account. Sign
 * up at resend.dev (free tier) and set RESEND_API_KEY to turn it on; no
 * other code needs to change.
 */
export type EmailResult = { ok: true; sent: boolean } | { ok: false; reason: string };

/** `sent` is false when the message was only logged because no provider is configured. */
export async function sendEmail(params: {
  to: string[];
  subject: string;
  text: string;
  // Where a reply should go (an access request is answered to the person who made it).
  replyTo?: string;
}): Promise<EmailResult> {
  if (params.to.length === 0) return { ok: true, sent: false };

  const client = getResendClient();
  if (!client) {
    console.log(`[email:console-fallback] to=${params.to.join(",")} subject="${params.subject}"\n${params.text}`);
    return { ok: true, sent: false };
  }

  try {
    const { error } = await client.emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: params.subject,
      text: params.text,
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    });
    if (error) {
      console.error(`[email] send failed: ${error.message}`);
      return { ok: false, reason: error.message };
    }
    return { ok: true, sent: true };
  } catch (e) {
    console.error(`[email] send failed: ${e instanceof Error ? e.message : e}`);
    return { ok: false, reason: "The email provider could not be reached." };
  }
}
