// Texts that reach t() without being written as t("…") in the code — enum values
// shown through t(humanizeEnum(value)), and option labels kept in lists — so the
// check (scripts/check-i18n.mjs) can't see them any other way. One per line.
// When a new enum value or list label is shown to users, add it here AND to
// src/lib/i18n/catalog.json.
export const EXTRA_KEYS = [
  // Patient stages
  "Identified",
  "Pre Screened",
  "Screened",
  "Consented",
  "Enrolled",
  "Screen Failed",
  "Withdrawn",
  // Visit statuses
  "Scheduled",
  "Completed",
  "Missed",
  "Rescheduled",
  // Document statuses and types
  "Pending",
  "Active",
  "Expired",
  "Superseded",
  "Protocol",
  "IB",
  "ICF",
  "Delegation Log",
  "Training Record",
  "Other",
  // Roles
  "CRC",
  "PI",
  "Org Admin",
  "Platform Admin",
  // Feedback areas (humanised enum values, and the form's option labels)
  "Recruitment",
  "Visits",
  "Documents",
  "Studies",
  "Login And Security",
  "Patients",
  "Login & Security",
] as const;
