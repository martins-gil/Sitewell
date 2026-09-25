import type { TFunction } from "@/lib/i18n/translate";
import { MAX_SAMPLES } from "@/lib/lab-shipments";
import type { ShipmentProblem } from "./actions";

// The words for what a shipment action answered with (see ShipmentResult in ./actions).
export function shipmentProblemText(t: TFunction, problem: ShipmentProblem, awb: string): string {
  switch (problem) {
    case "MISSING":
      return t("Choose a study and enter the airway bill (AWB) number and the shipping date.");
    case "BAD_AWB":
      return t("The AWB must be 4 to 40 characters: letters, digits, dashes or slashes.");
    case "BAD_DATE":
      return t("Enter a valid shipping date.");
    case "BAD_COUNT":
      return t("Sample counts must be whole numbers from 0 to {0}.", [MAX_SAMPLES]);
    case "NO_SAMPLES":
      return t("Enter how many samples were shipped — at least one, in ambient, refrigerated or frozen.");
    case "DUPLICATE_AWB":
      return t("A shipment with AWB {0} already exists.", [awb.trim().toUpperCase().replace(/\s+/g, " ")]);
    case "WRONG_STUDY":
      return t("A kit you ticked belongs to a different study.");
    case "KIT_NOT_USED":
      return t("A kit you ticked hasn't been given to a patient's visit, so it has no samples.");
    case "KIT_TAKEN":
      return t("A kit you ticked is already in another shipment.");
    case "MISSING_REASON":
      return t("Enter a short reason.");
  }
}
