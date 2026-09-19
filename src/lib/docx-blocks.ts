import { AlignmentType, Paragraph, TextRun } from "docx";

// Blocks the visit documents end with, laid out like the site's forms.

export function kitsParagraphs(kits: string[]): Paragraph[] {
  if (kits.length === 0) return [];
  return [
    new Paragraph({ spacing: { before: 360, after: 120 }, children: [new TextRun({ text: "Kits:" })] }),
    ...kits.map((name) => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `- ${name}` })] })),
  ];
}

/** Multi-line text as one paragraph per line. Not one paragraph with line
 * breaks: Word stretches a justified line that ends in a break to fill the
 * width, which turns "Patient arrived late." into a row of far-apart words. */
export function textLines(text: string, spacingBefore = 0): Paragraph[] {
  return text
    .trim()
    .split(/\r?\n/)
    .map(
      (line, i) =>
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: i === 0 ? { before: spacingBefore } : undefined,
          children: [new TextRun({ text: line })],
        }),
    );
}

export function notesParagraphs(notes: string | null): Paragraph[] {
  const text = notes?.trim();
  if (!text) return [];
  return [
    new Paragraph({ spacing: { before: 360, after: 120 }, children: [new TextRun({ text: "Notas:", bold: true })] }),
    ...textLines(text),
  ];
}
