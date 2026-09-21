// Text messages. Sent through Twilio when it is configured; otherwise written to
// the server log, exactly like email without a Resend key (src/lib/email.ts), so
// the feature can be built and tried before an account exists.
//
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN   the account
//   TWILIO_FROM                              the sending number (+351…) or an alphanumeric sender id
//   TWILIO_MESSAGING_SERVICE_SID             alternatively, a Messaging Service (used instead of FROM)
//
// Only the phone number and the message text are sent to the provider — never a
// patient's name or any other patient information (the messages only carry the
// patient CODE and visit name, like the calendar).

export function smsConfigured(): boolean {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, TWILIO_MESSAGING_SERVICE_SID } = process.env;
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && (TWILIO_FROM || TWILIO_MESSAGING_SERVICE_SID));
}

/**
 * A phone number in international format ("+351912345678") from what someone
 * typed, or null if it can't be one. Spaces, dots, dashes and brackets are
 * ignored, "00" is read as "+", and a bare nine-digit Portuguese mobile number
 * (9xxxxxxxx) gets +351 — the site's own country.
 */
export function normalizePhone(raw: string): string | null {
  let text = raw.trim().replace(/[\s.\-()]/g, "");
  if (text.startsWith("00")) text = `+${text.slice(2)}`;
  if (/^9\d{8}$/.test(text)) text = `+351${text}`;
  return /^\+[1-9]\d{7,14}$/.test(text) ? text : null;
}

export type SmsResult = { ok: true; sent: boolean } | { ok: false; reason: string };

/** `sent` is false when the message was only logged because no provider is configured. */
export async function sendSms(params: { to: string; body: string }): Promise<SmsResult> {
  if (!smsConfigured()) {
    console.log(`[sms:console-fallback] to=${params.to}\n${params.body}`);
    return { ok: true, sent: false };
  }

  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from, TWILIO_MESSAGING_SERVICE_SID: service } = process.env;
  const form = new URLSearchParams({ To: params.to, Body: params.body });
  if (service) form.set("MessagingServiceSid", service);
  else if (from) form.set("From", from);

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    if (!response.ok) {
      // Twilio's reply carries a numeric code and a message; log both for whoever runs the site.
      const detail = await response.text().catch(() => "");
      console.error(`[sms] Twilio answered ${response.status}: ${detail.slice(0, 300)}`);
      return { ok: false, reason: `The SMS provider answered ${response.status}.` };
    }
    return { ok: true, sent: true };
  } catch (error) {
    console.error("[sms] request failed:", error instanceof Error ? error.message : error);
    return { ok: false, reason: "The SMS provider could not be reached." };
  }
}
