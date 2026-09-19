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
