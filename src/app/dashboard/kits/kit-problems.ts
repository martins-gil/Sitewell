import type { TFunction } from "@/lib/i18n/translate";
import { MAX_KITS_PER_ADD } from "@/lib/kit-stock";
import type { KitProblem } from "./actions";

// The words for what a kit action answered with (see KitResult in ./actions).
export function kitProblemText(t: TFunction, problem: KitProblem): string {
  switch (problem) {
    case "MISSING":
      return t("Choose a study, give the kit a name, and enter a quantity of at least 1.");
    case "TOO_MANY":
      return t("You can add at most {0} kits at a time.", [MAX_KITS_PER_ADD]);
    case "QUANTITY_WITH_VISIT":
      return t("Kits added together can't be linked to a visit — add one kit to link it.");
    case "WRONG_STUDY":
      return t("That visit belongs to a different study.");
    case "LOCKED":
      return t("This kit is assigned to a patient's visit and is locked. Release it from that visit first.");
    case "EXPIRED":
      return t("This kit has expired, so it can't be given to a patient.");
    case "USED":
      return t("This kit was already used and removed from inventory.");
    case "NOT_LINKED":
      return t("Link this kit to a visit before marking it used.");
    case "NOT_HAPPENED":
      return t("That visit hasn't happened yet.");
    case "VISIT_HAPPENED":
      return t("The visit has already happened, so its kit stays locked to it.");
  }
}
