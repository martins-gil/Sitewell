import { Resend } from "resend";

const FROM_ADDRESS = process.env.EMAIL_FROM || "Sitepilot <onboarding@resend.dev>";

let resendClient: Resend | null = null;
function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

/**
 * Sends real email when RESEND_API_KEY is set; otherwise logs to the
 * console. No account/API key has been configured in this environment, so
 * every reminder so far has gone through the console path — the Resend
 * path is written and ready, just unverified against a live account. Sign
 * up at resend.dev (free tier) and set RESEND_API_KEY to turn it on; no
 * other code needs to change.
 */
export async function sendEmail(params: { to: string[]; subject: string; text: string }): Promise<void> {
  if (params.to.length === 0) return;

  const client = getResendClient();
  if (!client) {
    console.log(`[email:console-fallback] to=${params.to.join(",")} subject="${params.subject}"\n${params.text}`);
    return;
  }

  const { error } = await client.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });

  if (error) {
    console.error(`[email] send failed: ${error.message}`);
  }
}
