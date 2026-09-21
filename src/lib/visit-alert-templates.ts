import { z } from "zod";

// The wording of the weekly "visits next week" email and text message. An
// organization can write its own (Settings → Notifications); until then these
// defaults are used. Words in {curly braces} are filled in for each recipient:
//
//   {name}    the recipient's first name
//   {week}    the week the message is about, e.g. "Mon 28 Sep – Sun 4 Oct"
//   {count}   how many visits (patient and monitoring) are planned that week
//   {visits}  the list of them (one per line in an email; short and joined in a text)
//   {link}    the address of the visit calendar
//
// Anything else in braces is left exactly as typed.

export type VisitAlertTemplates = { emailSubject: string; emailBody: string; smsBody: string };

export const DEFAULT_TEMPLATES: VisitAlertTemplates = {
  emailSubject: "Next week: {count} visit(s) planned ({week})",
  emailBody: [
    "Hi {name},",
    "",
    "Here is what is planned for next week ({week}):",
    "",
    "{visits}",
    "",
    "Open the calendar: {link}",
    "",
    "This is an automated message from SiteWell-ct.",
  ].join("\n"),
  smsBody: "SiteWell-ct: Hi {name}, next week ({week}) you have {count} visit(s): {visits} {link}",
};

export const PLACEHOLDERS = ["{name}", "{week}", "{count}", "{visits}", "{link}"] as const;

export const TEMPLATE_LIMITS = { emailSubject: 150, emailBody: 3000, smsBody: 400 } as const;

const templateSchema = z.object({
  emailSubject: z.string().trim().min(1).max(TEMPLATE_LIMITS.emailSubject),
  emailBody: z.string().trim().min(1).max(TEMPLATE_LIMITS.emailBody),
  smsBody: z.string().trim().min(1).max(TEMPLATE_LIMITS.smsBody),
});

/** The organization's stored wording, with the default for anything missing or invalid. */
export function readTemplates(stored: unknown): VisitAlertTemplates {
  const source = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  const pick = (key: keyof VisitAlertTemplates): string => {
    const value = templateSchema.shape[key].safeParse(source[key]);
    return value.success ? value.data : DEFAULT_TEMPLATES[key];
  };
  return { emailSubject: pick("emailSubject"), emailBody: pick("emailBody"), smsBody: pick("smsBody") };
}

/** Validates what an admin typed; the first problem is returned as a message. */
export function checkTemplates(input: VisitAlertTemplates): { ok: true; templates: VisitAlertTemplates } | { ok: false; problem: string } {
  const result = templateSchema.safeParse(input);
  if (result.success) return { ok: true, templates: result.data };
  const field = String(result.error.issues[0]?.path[0] ?? "");
  const label = field === "emailSubject" ? "The email subject" : field === "emailBody" ? "The email text" : "The text message";
  const limit = TEMPLATE_LIMITS[field as keyof typeof TEMPLATE_LIMITS];
  return { ok: false, problem: `${label} can't be empty${limit ? ` or longer than ${limit} characters` : ""}.` };
}

/** Fills in the {placeholders}; unknown ones are kept as they are. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? values[key] : whole));
}
