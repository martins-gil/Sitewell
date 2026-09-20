// Display preferences (safe to import from client components).

// Colours for the left bar with the sections. Every coloured option is dark
// enough for white text, so it reads the same in the light and dark themes;
// "light" is the plain grey bar. (The labels go through t() in Settings.)
export const SIDEBAR_COLORS = [
  { id: "navy", label: "Navy", bg: "#12284c" },
  { id: "blue", label: "Blue", bg: "#1d4e89" },
  { id: "teal", label: "Teal", bg: "#0f5257" },
  { id: "green", label: "Green", bg: "#1b4d3e" },
  { id: "purple", label: "Purple", bg: "#3d2a6b" },
  { id: "wine", label: "Wine", bg: "#5a1f36" },
  { id: "charcoal", label: "Charcoal", bg: "#20242b" },
  { id: "light", label: "Light", bg: null },
] as const;

export type SidebarColorId = (typeof SIDEBAR_COLORS)[number]["id"];
export const DEFAULT_SIDEBAR_COLOR: SidebarColorId = "navy";

export function isSidebarColor(value: unknown): value is SidebarColorId {
  return SIDEBAR_COLORS.some((c) => c.id === value);
}

// Sections of a visit's page that can be shown, collapsed or hidden. The
// labels are the English text used on the page and in Settings.
export const VISIT_SECTIONS = [
  { id: "details", label: "Document details (printed on the .docx)" },
  { id: "checklist", label: "Procedure checklist" },
  { id: "nursing", label: "Nursing sheet" },
  { id: "notes", label: "Notes" },
  { id: "kits", label: "Kits for this visit" },
  { id: "documents", label: "Documents for this visit" },
] as const;

// The same for a patient's page.
export const PATIENT_SECTIONS = [{ id: "criteria", label: "I/E criteria" }] as const;

export type VisitSectionId = (typeof VISIT_SECTIONS)[number]["id"];
export type PatientSectionId = (typeof PATIENT_SECTIONS)[number]["id"];
export type SectionId = VisitSectionId | PatientSectionId;

const ALL_SECTIONS: readonly { id: SectionId }[] = [...VISIT_SECTIONS, ...PATIENT_SECTIONS];

export const SECTION_MODES = ["show", "collapsed", "hidden"] as const;
export type SectionMode = (typeof SECTION_MODES)[number];

export type SectionModes = Record<SectionId, SectionMode>;

export function defaultSectionModes(): SectionModes {
  return Object.fromEntries(ALL_SECTIONS.map((s) => [s.id, "show"])) as SectionModes;
}

/** The stored cookie value, sanitised: anything unknown falls back to "show". */
export function parseSectionModes(raw: string | undefined): SectionModes {
  const modes = defaultSectionModes();
  if (!raw) return modes;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      for (const { id } of ALL_SECTIONS) {
        const value = (parsed as Record<string, unknown>)[id];
        if ((SECTION_MODES as readonly unknown[]).includes(value)) modes[id] = value as SectionMode;
      }
    }
  } catch {
    // A mangled cookie just means defaults.
  }
  return modes;
}
