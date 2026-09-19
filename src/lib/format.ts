/** A short date in the given app language ("22 Sept 2026", "22 sept. 2026", …). */
export function formatDate(date: Date | string | null | undefined, locale: string = "en"): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(locale === "en" ? "en-US" : locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function isWithinDays(date: Date | null, days: number): boolean {
  if (!date) return false;
  return date.getTime() - Date.now() < days * 24 * 60 * 60 * 1000;
}

// Times the coordinator types in ("when was this procedure done") are stored
// as a "floating" wall-clock value: the digits entered, kept as if UTC, and
// always read back in UTC — so 14:30 is 14:30 on every device and on the
// printed document, whatever timezone the server or browser is in.
export function toDateTimeInput(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 16) : "";
}

export function parseDateTimeInput(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid date and time.");
  return date;
}

/** "22/09/2026 14:30" — the floating wall-clock value above. */
export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  const iso = date.toISOString();
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}`;
}

/** Whole days from now until the date (negative once it's past). */
export function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export function isPast(date: Date | null): boolean {
  if (!date) return false;
  return date.getTime() < Date.now();
}

const ACRONYMS = new Set(["ib", "icf", "crc", "pi"]);

// "PRE_SCREENED" -> "Pre Screened". Acronyms (IB, ICF, CRC, PI) stay upper-case.
// The result is also the key the text is translated by.
export function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
}
