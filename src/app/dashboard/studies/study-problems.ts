import type { TFunction } from "@/lib/i18n/translate";
import type { StudyProblem } from "./actions";

// The words for what a study action answered with (see StudyResult in ./actions).
export function studyProblemText(t: TFunction, problem: StudyProblem, protocolId: string): string {
  switch (problem) {
    case "MISSING":
      return t("Enter the study acronym (protocol ID).");
    case "DUPLICATE":
      return t("A study with protocol ID {0} already exists.", [protocolId.trim()]);
    case "DEPARTMENT_NAME":
      return t("Enter a name for the new department.");
    case "DEPARTMENT_GONE":
      return t("That department no longer exists.");
  }
}
