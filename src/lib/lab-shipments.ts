// Rules for laboratory sample shipments (Lab samples).

/** Highest sample count for one temperature in one shipment. */
export const MAX_SAMPLES = 99999;

/** An airway bill (AWB) or courier waybill number: letters, digits, dashes, slashes and
 * spaces, 4 to 40 characters — e.g. "176-12345675" or "1Z999AA10123456784". */
const AWB = /^[A-Z0-9][A-Z0-9 \-/]{3,39}$/;

/** The AWB as it is stored: trimmed, upper-case, single spaces. Null when it isn't one. */
export function normalizeAwb(raw: string): string | null {
  const awb = raw.trim().toUpperCase().replace(/\s+/g, " ");
  return AWB.test(awb) ? awb : null;
}

/** A whole number of samples from a form field; null when it isn't 0 to MAX_SAMPLES. */
export function parseSampleCount(raw: FormDataEntryValue | null): number | null {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text === "") return 0;
  const n = Number(text);
  return Number.isInteger(n) && n >= 0 && n <= MAX_SAMPLES ? n : null;
}
