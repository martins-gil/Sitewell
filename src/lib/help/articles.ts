import type { TFunction } from "@/lib/i18n/translate";

// The Help page's questions and answers. Written as "how do I…" questions a
// coordinator would actually ask, with the steps in order. Every text goes
// through t() like the rest of the app, so the page follows the chosen language.
// The Help assistant also reads these (in English) as its only source of truth:
// when a screen changes, change the matching article here.

export type HelpArticle = {
  id: string;
  category: string;
  question: string;
  answer: string;
  steps: string[];
  href?: string;
  // Other words people use for the same thing (English, never shown): they help
  // the assistant's plain search find this article when it isn't using AI.
  keywords?: string;
};

export function helpArticles(t: TFunction): HelpArticle[] {
  const start = t("Getting started");
  const studies = t("Studies");
  const patients = t("Patients");
  const visits = t("Visits");
  const documents = t("Documents");
  const kits = t("Kits");
  const account = t("Account and team");
  const trouble = t("When something doesn't work");

  return [
    {
      id: "sign-in",
      category: start,
      question: t("I can't sign in — what do I do?"),
      answer: t("Check the email and password first. After 5 wrong attempts in a row the account is locked for 15 minutes, and the message looks the same as for a wrong password."),
      steps: [
        t("Wait 15 minutes, then try again."),
        t("Still stuck? Ask your organisation's admin to open Settings → Team and press “Reset password” next to your name."),
        t("Sign in with the temporary password they give you, then choose your own when the amber bar appears."),
      ],
    },
    {
      id: "find-anything",
      category: start,
      question: t("How do I find a patient or a visit quickly?"),
      answer: t("Use the search bar at the top of every page (or press Ctrl+K). Type several words at once — all of them have to match."),
      steps: [
        t("Type the patient code and the visit, for example “RCN-101-0009 week 4”."),
        t("Pick a result with the mouse, or with the arrow keys and Enter, to open it."),
        t("Choose “See all results” to get the full list, grouped by patients, visits, studies, documents and kits."),
      ],
    },
    {
      id: "preferences",
      category: start,
      question: t("How do I change the language, the colours or what I see on a page?"),
      answer: t("These are your own display settings, saved in this browser. They don't change anything for your colleagues."),
      steps: [
        t("Open Settings."),
        t("Choose the language, the light or dark theme and the colour of the left bar."),
        t("For each section of the visit page (and the I/E criteria on a patient) choose whether it is shown, collapsed or hidden."),
      ],
      href: "/dashboard/settings",
      keywords: "language translate theme dark mode colour color sidebar appearance",
    },
    {
      id: "test-data",
      category: start,
      question: t("Can I enter real patient information?"),
      answer: t("Not yet. During the pilot only made-up test data is allowed — no names, dates of birth, or real subject numbers."),
      steps: [
        t("Use invented codes such as “RCN-101-0009” for patients."),
        t("Never type patient details into the Help assistant either."),
      ],
    },
    {
      id: "add-study",
      category: studies,
      question: t("How do I add a study?"),
      answer: t("Only an organisation admin can add or edit studies. If you don't see the button, ask your admin."),
      steps: [
        t("Open Studies and press “Add study”."),
        t("Fill in the protocol number, title, phase and sponsor, and pick a department (or type a new one)."),
        t("Save, then open the study to set the PI name and the site number."),
      ],
      href: "/dashboard/studies",
    },
    {
      id: "visit-schedule",
      category: studies,
      question: t("How do I set up the visits of a study?"),
      answer: t("Each visit type (Screening, Baseline, Week 4…) is defined once per study. Every patient's visit of that type shares its checklist and documents."),
      steps: [
        t("Open the study and choose “Visit schedule →”."),
        t("Add each visit type with its offset in days from Baseline and its window before and after."),
        t("Open a visit type's checklist to list the procedures done at that visit."),
      ],
    },
    {
      id: "study-criteria",
      category: studies,
      question: t("How do I enter a study's inclusion and exclusion criteria?"),
      answer: t("Paste the text from the protocol and it is split into separate bullet points, inclusion and exclusion apart. New patients of the study start from this list."),
      steps: [
        t("Open the study and find “Eligibility criteria (I/E)”."),
        t("Press “Paste from the protocol →”, paste the text and press “Turn into bullet points”."),
        t("Check both lists: use ⇄ to move a line that landed on the wrong side, fix any wording, then press “Save criteria”."),
      ],
    },
    {
      id: "pi-site",
      category: studies,
      question: t("Where do the PI name, site number and protocol version on the checklist come from?"),
      answer: t("The PI name and site number come from the study. The protocol version and release date come from the study's protocol document."),
      steps: [
        t("Set the PI name and site number on the study page."),
        t("Add the protocol in Documents (type Protocol) with its version and release date, and make it Active."),
        t("You can also correct them from any visit's page — that changes the document for every visit of the study."),
      ],
    },
    {
      id: "add-patient",
      category: patients,
      question: t("How do I add a patient?"),
      answer: t("Patients are added with an invented code during the pilot. You can copy the visits and criteria of a similar patient to save typing."),
      steps: [
        t("Open Patients and press “Add patient”."),
        t("Choose the study and enter the code (and initials, if you want)."),
        t("Optionally pick “Copy from an existing patient” to reuse their visits and criteria."),
        t("When you copy a patient, enter the “Baseline / Day 0 date”: every protocol visit is placed on its day counted from Baseline automatically, and a repeated visit keeps its spacing."),
        t("Check the list of visits, change or remove rows if needed, and save."),
      ],
      href: "/dashboard/subjects",
      keywords: "new subject participant create register enrol enroll",
    },
    {
      id: "funnel",
      category: patients,
      question: t("How do I move a patient to the next stage?"),
      answer: t("The stage is a drop-down at the top of the patient's page: Identified, Pre Screened, Screened, Consented, Enrolled, Screen Failed or Withdrawn."),
      steps: [
        t("Open the patient."),
        t("Under “Funnel stage” choose the new stage from the list."),
        t("When a patient becomes Enrolled and has no visits yet, the study's protocol visits are created automatically."),
      ],
    },
    {
      id: "patient-criteria",
      category: patients,
      question: t("How do I record whether a patient meets the criteria?"),
      answer: t("The patient's criteria are listed as Inclusion and Exclusion. Load the study's list, or paste criteria text, then answer each one."),
      steps: [
        t("Open the patient and find the I/E criteria section."),
        t("Press “Load the study's criteria”, or “Paste criteria text →” to use other text."),
        t("For an inclusion criterion choose Met or Not met; for an exclusion criterion choose Applies or Doesn't apply. “?” means not assessed yet."),
      ],
    },
    {
      id: "print-ie",
      category: patients,
      question: t("How do I print the inclusion and exclusion criteria?"),
      answer: t("The criteria download as a Word document in the same style as the checklist, with Sim / Não boxes and a line for the investigator's date and signature."),
      steps: [
        t("For one patient: open the patient and press “Download I/E criteria (.docx)” under the criteria — the answers you recorded come ticked."),
        t("For a blank form of the whole study: open the study and press “Download blank I/E form (.docx)”."),
        t("Sim / Não answers the criterion as written, so on an exclusion criterion “Sim” means it applies to the patient."),
      ],
      keywords: "print export word docx eligibility form source document",
    },
    {
      id: "add-visit",
      category: visits,
      question: t("How do I add visits to a patient?"),
      answer: t("Visits can be added once the patient is pre-screened, screened, consented or enrolled."),
      steps: [
        t("Open the patient and use the box above the list of visits."),
        t("Pick a visit type and a date to add one visit, or use “Add protocol visits” to create every visit of the protocol from a Day 0 date."),
        t("Fix a date later with “Edit dates” on that visit's row."),
      ],
    },
    {
      id: "repeat-visit",
      category: visits,
      question: t("Some visits are identical — can I repeat one instead of building it again?"),
      answer: t("Yes. “Repeat” makes a new visit with the same documents and checklist; only the name and the date change (for example Week 4 → Week 8)."),
      steps: [
        t("In the patient's list of visits press “Repeat” on the visit, or open the visit and choose “Repeat or copy this visit →”."),
        t("Type the new name and pick the target date."),
        t("To copy it to another patient of the same study, choose that patient."),
        t("Press “Repeat visit”. The new visit starts with an empty, unticked checklist."),
      ],
      keywords: "copy duplicate clone same again another week rename similar",
    },
    {
      id: "share-calendar",
      category: visits,
      question: t("How do I put the visits in my phone, Google or Outlook calendar?"),
      answer: t("Use “Share this calendar” on Visits Schedule to get a private link. Your calendar app subscribes to it and keeps itself up to date; each visit shows the study, the patient, the visit and its kits, and opens that exact visit here."),
      steps: [
        t("Open Visits Schedule and press “Share this calendar (Apple, Google, Outlook) →”."),
        t("Press “Create my calendar link”, then “Copy link” — or, on an iPhone or Mac, press “Add to Apple Calendar”."),
        t("In Google Calendar choose Other calendars (+) → From URL; in Outlook choose Add calendar → Subscribe from web. Paste the link."),
        t("If the link gets out, press “Make a new link” — the old one stops working. “Turn sharing off” stops it altogether."),
      ],
      href: "/dashboard/visits",
      keywords: "ics ical export sync phone iphone android google outlook apple subscribe link",
    },
    {
      id: "reschedule",
      category: visits,
      question: t("How do I move a visit or mark it as done?"),
      answer: t("Use the buttons on the visit's row in Visits Schedule. Entering the date it actually happened on the visit's page also marks it Completed."),
      steps: [
        t("Open Visits Schedule and find the visit."),
        t("Press “Complete” when it is done, “Missed” if it didn't happen, or “Reschedule” and pick the new date."),
        t("To change the windows, or to enter the actual date, open the visit itself."),
      ],
      href: "/dashboard/visits",
      keywords: "postpone change date cancel done finish completed missed late window",
    },
    {
      id: "checklist",
      category: visits,
      question: t("How do I fill in and print a visit's procedure checklist?"),
      answer: t("The checklist is on the visit page. Tick each procedure as it is done — some visit types record the date and time instead."),
      steps: [
        t("Open the visit and tick each procedure, or enter its date and time when asked."),
        t("Press “Download filled checklist (.docx)” under the list."),
        t("If the PI, site or protocol version at the top is wrong, correct it on the study (see “Where do the PI name…”)."),
      ],
      keywords: "print word docx form download procedures tick verify",
    },
    {
      id: "checklist-edit",
      category: visits,
      question: t("How do I add procedures to a checklist — for every patient, or for one visit only?"),
      answer: t("A procedure added to the visit type appears on every patient's visit of that type. One added on a visit page stays on that visit only."),
      steps: [
        t("For every patient: Studies → the study → Visit schedule → the visit type's checklist → “Add a checklist item”."),
        t("For one visit only: open the visit and press “+ Add a procedure to this visit”."),
        t("Have the list as text? Press “Paste a list of procedures →”, turn it into lines, check them and add them all at once."),
      ],
    },
    {
      id: "nursing-sheet",
      category: visits,
      question: t("Where is the nursing sheet?"),
      answer: t("Every visit can download one. Until its visit type has its own, the standard sheet is used."),
      steps: [
        t("Open the visit and press “Download nursing sheet (.docx)”."),
        t("To give a visit type its own sheet: Studies → the study → Visit schedule → that visit type → nursing sheet."),
        t("The nurse's readings are written by hand on the printout; they are not stored in the app."),
      ],
    },
    {
      id: "add-document",
      category: documents,
      question: t("How do I log a document (consent form, protocol, delegation log…)?"),
      answer: t("A document belongs to a study, and optionally to one patient and one visit. Attaching the file is optional."),
      steps: [
        t("Open Documents and press “Add document”."),
        t("Choose the type, the study (and the patient or visit if it applies), the version, the dates and the status."),
        t("Attach the file if you have it, then save."),
      ],
      href: "/dashboard/documents",
      keywords: "upload file icf consent eisf isf training log delegation",
    },
    {
      id: "document-status",
      category: documents,
      question: t("What do the document statuses mean?"),
      answer: t("Pending: not in force yet. Active: the current version. Expired: past its expiry date. Superseded: replaced by a newer version."),
      steps: [
        t("Change a status from the status control in the Documents list."),
        t("Making a document Active retires the older Active version with the same type, title, study, patient and visit."),
        t("An Active document whose expiry date has passed is shown as Expired — correct the expiry date before making it Active."),
      ],
    },
    {
      id: "kits",
      category: kits,
      question: t("How do I keep track of kits and their expiry dates?"),
      answer: t("A banner warns about kits that expire within 28 days, every day, until you order a replacement."),
      steps: [
        t("Open Kits Inventory and press “Add kit”."),
        t("Link it to a visit type, or to one patient's visit."),
        t("Press “Mark as ordered” once a replacement is ordered — that stops the warning."),
        t("After the visit it belongs to has taken place, press “Remove (used)” to take the kit off the inventory."),
      ],
      href: "/dashboard/kits",
    },
    {
      id: "team",
      category: account,
      question: t("How do I add a colleague, or help someone who forgot their password?"),
      answer: t("Only an organisation admin can. Settings → Team lists everyone in the organisation."),
      steps: [
        t("Open Settings → Team and press “Add team member”."),
        t("Give them a temporary password of at least 12 characters; they'll be asked to choose their own."),
        t("For a forgotten password or a locked account, press “Reset password” next to their name."),
      ],
      href: "/dashboard/settings/team",
      keywords: "user invite account access admin reset forgot lock locked",
    },
    {
      id: "change-password",
      category: account,
      question: t("How do I change my password?"),
      answer: t("A password needs at least 12 characters and can't contain your email or be one repeated character."),
      steps: [
        t("Open Settings → Security."),
        t("Enter your current password and the new one, then save."),
      ],
      href: "/dashboard/settings/security",
    },
    {
      id: "missing-button",
      category: trouble,
      question: t("I can't see the “Add study” button or the Team page."),
      answer: t("Adding and editing studies, and managing the team, is reserved for organisation admins. Ask yours to do it, or to change your role."),
      steps: [],
    },
    {
      id: "file-fails",
      category: trouble,
      question: t("Attaching a file to a document fails."),
      answer: t("Save the document without a file. Its status, dates and version are still tracked, and you can keep the paper or electronic original in your usual place."),
      steps: [],
    },
    {
      id: "not-found",
      category: trouble,
      question: t("I can't find an answer here."),
      answer: t("Tell us what you were trying to do — it helps improve this page."),
      steps: [
        t("Open Feedback and describe what you were trying to do and what happened."),
      ],
      href: "/dashboard/feedback",
    },
  ];
}
