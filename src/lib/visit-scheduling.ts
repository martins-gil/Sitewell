import type { SubjectStatus } from "@prisma/client";

// A patient's visit program can be built once they're past initial
// identification: pre-screened, screened, consented, or enrolled. (Consented
// sits between screened and enrolled, so leaving it out would be odd.) Not
// for identified-only, screen-failed, or withdrawn patients.
export const SCHEDULABLE_STATUSES: SubjectStatus[] = [
  "PRE_SCREENED",
  "SCREENED",
  "CONSENTED",
  "ENROLLED",
];

export function canScheduleVisits(status: string): boolean {
  return (SCHEDULABLE_STATUSES as string[]).includes(status);
}

export const DAY_MS = 24 * 60 * 60 * 1000;

// Noon UTC, not midnight: a date-only value stays on the same calendar day
// for anyone within ±12 hours of UTC, instead of slipping to the day before
// west of Greenwich.
export function parseDateOnly(raw: string): Date {
  const date = new Date(`${raw}T12:00:00Z`);
  if (!raw || Number.isNaN(date.getTime())) throw new Error("Enter a valid date.");
  return date;
}

export function wholeDays(raw: unknown): number {
  return Math.max(0, Math.trunc(Number(raw) || 0));
}
