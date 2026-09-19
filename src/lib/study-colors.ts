// Colours that let a coordinator tell studies and patients apart at a glance
// (mainly on the calendar): each study has one hue, and each of its patients
// gets a different tone of that hue.
//
// Safe to import from client components — no dependencies.

export const STUDY_COLORS = [
  { id: "blue", label: "Blue", hue: 215 },
  { id: "green", label: "Green", hue: 140 },
  { id: "orange", label: "Orange", hue: 28 },
  { id: "purple", label: "Purple", hue: 275 },
  { id: "teal", label: "Teal", hue: 178 },
  { id: "pink", label: "Pink", hue: 335 },
  { id: "yellow", label: "Yellow", hue: 48 },
  { id: "red", label: "Red", hue: 2 },
  { id: "indigo", label: "Indigo", hue: 245 },
  { id: "lime", label: "Lime", hue: 85 },
] as const;

export type StudyColorId = (typeof STUDY_COLORS)[number]["id"];

export function isStudyColor(value: unknown): value is StudyColorId {
  return STUDY_COLORS.some((c) => c.id === value);
}

function hueOf(colorId: string): number {
  return (STUDY_COLORS.find((c) => c.id === colorId) ?? STUDY_COLORS[0]).hue;
}

/**
 * The colour of every study: the one it was given, else the first palette
 * colour no other study uses (oldest study first, so colours stay put as
 * studies are added). Beyond ten studies the palette repeats.
 */
export function resolveStudyColors(
  studies: { id: string; color: string | null; createdAt: Date }[],
): Record<string, StudyColorId> {
  const result: Record<string, StudyColorId> = {};
  const used = new Set<string>();
  for (const s of studies) {
    if (isStudyColor(s.color)) {
      result[s.id] = s.color;
      used.add(s.color);
    }
  }
  const pending = studies.filter((s) => !(s.id in result)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let next = 0;
  for (const s of pending) {
    const free = STUDY_COLORS.find((c) => !used.has(c.id));
    const pick = free ?? STUDY_COLORS[next++ % STUDY_COLORS.length];
    result[s.id] = pick.id;
    used.add(pick.id);
  }
  return result;
}

/** The first palette colour not yet taken — the pre-selected one when adding a study. */
export function firstFreeStudyColor(taken: Iterable<string>): StudyColorId {
  const used = new Set(taken);
  return (STUDY_COLORS.find((c) => !used.has(c.id)) ?? STUDY_COLORS[0]).id;
}

/** The study's own colour (swatches, legends). */
export function studyColor(colorId: string): string {
  return `hsl(${hueOf(colorId)} 72% 48%)`;
}

// Six tones, dark to light, kept mid-range so they read on white and on black.
const TONE_LIGHTNESS = [34, 42, 50, 58, 66, 74];

/** A patient's tone of the study's colour, from the number at the end of their code
 * (RCN-204-0014 -> 14): patients of one study never share a tone until the seventh. */
export function patientTone(colorId: string, subjectCode: string): string {
  const number = Number(subjectCode.match(/(\d+)\D*$/)?.[1] ?? 0);
  const lightness = TONE_LIGHTNESS[number % TONE_LIGHTNESS.length];
  return `hsl(${hueOf(colorId)} 70% ${lightness}%)`;
}

/** The same tone as a translucent wash, for a chip's background. */
export function patientWash(colorId: string, subjectCode: string): string {
  return patientTone(colorId, subjectCode).replace(")", " / 0.16)");
}
