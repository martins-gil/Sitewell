// Display preferences (safe to import from client components).

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

export type VisitSectionId = (typeof VISIT_SECTIONS)[number]["id"];

export const SECTION_MODES = ["show", "collapsed", "hidden"] as const;
export type SectionMode = (typeof SECTION_MODES)[number];

export type SectionModes = Record<VisitSectionId, SectionMode>;

export function defaultSectionModes(): SectionModes {
  return Object.fromEntries(VISIT_SECTIONS.map((s) => [s.id, "show"])) as SectionModes;
}

/** The stored cookie value, sanitised: anything unknown falls back to "show". */
export function parseSectionModes(raw: string | undefined): SectionModes {
  const modes = defaultSectionModes();
  if (!raw) return modes;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      for (const { id } of VISIT_SECTIONS) {
        const value = (parsed as Record<string, unknown>)[id];
        if ((SECTION_MODES as readonly unknown[]).includes(value)) modes[id] = value as SectionMode;
      }
    }
  } catch {
    // A mangled cookie just means defaults.
  }
  return modes;
}
