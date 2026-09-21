import type { TFunction } from "@/lib/i18n/translate";
import type { TeamProblem } from "./actions";

// The words for what a team action answered with (see TeamResult in ./actions).
export function teamProblemText(t: TFunction, problem: TeamProblem, email: string): string {
  switch (problem) {
    case "MISSING":
      return t("Name and email are required.");
    case "INVALID_ROLE":
      return t("Invalid role.");
    case "BAD_PHONE":
      return t("That doesn't look like a phone number — use the international format, e.g. +351 912 345 678.");
    case "SMS_NEEDS_PHONE":
      return t("Add a mobile number to send this person text messages.");
    case "BAD_PASSWORD":
      return t("The temporary password must be at least 12 characters and not contain the email address.");
    case "EMAIL_TAKEN":
      return t("A user with email {0} already exists.", [email]);
    case "SELF":
      return t("You can't delete your own account.");
    case "HAS_RECORDS":
      return t("This person has signed documents or sent feedback, so they can't be removed — those records must stay. Use Edit to change their name or email, or Reset password.");
  }
}
