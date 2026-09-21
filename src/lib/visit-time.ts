// A visit's time of day: "HH:mm" on the clinic's own wall clock. Like visit dates
// (which are day-only), it is a "floating" value with no time zone — 09:30 means
// 09:30 wherever the site is — so it is stored as text and never run through a
// Date, which would shift it by the server's offset.

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** A form's time field as "HH:mm", or null when it is empty or not a real time. */
export function parseStartTime(raw: FormDataEntryValue | string | null | undefined): string | null {
  const text = typeof raw === "string" ? raw.trim() : "";
  return TIME.test(text) ? text : null;
}

/** For sorting: visits with a time first (earliest first), then those without. */
export function compareStartTime(a: string | null | undefined, b: string | null | undefined): number {
  if (a && b) return a.localeCompare(b);
  if (a) return -1;
  if (b) return 1;
  return 0;
}
