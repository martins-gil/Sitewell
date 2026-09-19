import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Tab,
  TabStopType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { formatDateTime } from "@/lib/format";
import { kitsParagraphs, notesParagraphs } from "@/lib/docx-blocks";
import type { NursingSheet, NursingSheetSection } from "@/lib/nursing-sheet";

export type NursingSheetDocxHeader = {
  visitType: string;
  subjectCode: string;
  initials: string | null;
  actualDate: Date | null;
  protocolId: string;
  protocolVersion: string | null;
  protocolReleaseDate: Date | null;
  piName: string | null;
  siteNumber: string | null;
  kits: string[];
  notes: string | null;
};

// Same page as the procedure checklist: A4, 3 cm side margins.
const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const SIDE_MARGIN = 1701;
const TEXT_WIDTH = PAGE_WIDTH - 2 * SIDE_MARGIN;

const LINE = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const BORDERS = { top: LINE, bottom: LINE, left: LINE, right: LINE };
const BLUE_RULE = { style: BorderStyle.SINGLE, size: 4, color: "5B9BD5", space: 4 };
const GREY_BAND = { type: ShadingType.CLEAR, color: "auto", fill: "D0CECE" };
const GREY_HEAD = { type: ShadingType.CLEAR, color: "auto", fill: "E7E6E6" };

// Half-points (22 = 11pt), measured off the site's paper records.
const BODY = 22;
const MEDIUM = 24;
const BIG = 32;
const ROW_HEIGHT = 560;

const COLUMN_TITLES = { result: "Resultado", time: "Hora", observations: "OBSERVAÇÕES" } as const;
// Relative widths of the fillable columns; the label column gets the rest.
const COLUMN_WEIGHTS = { result: 3.2, time: 1.6, observations: 3.2 } as const;
const LABEL_WEIGHT = 2.6;

function p(text: string, opts: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    alignment: opts.align,
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? BODY })],
  });
}

function tableCell(
  width: number,
  children: Paragraph[],
  opts: { shading?: typeof GREY_BAND; columnSpan?: number; rowSpan?: number; center?: boolean } = {},
) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: BORDERS,
    shading: opts.shading,
    columnSpan: opts.columnSpan,
    rowSpan: opts.rowSpan,
    verticalAlign: opts.center ? VerticalAlign.CENTER : undefined,
    children,
  });
}

function sectionColumns(section: NursingSheetSection) {
  const keys = (["result", "time", "observations"] as const).filter((k) => section.columns[k]);
  const weightSum = LABEL_WEIGHT + keys.reduce((sum, k) => sum + COLUMN_WEIGHTS[k], 0);
  const labelWidth = Math.round((TEXT_WIDTH * LABEL_WEIGHT) / weightSum);
  const widths = keys.map((k) => Math.round((TEXT_WIDTH * COLUMN_WEIGHTS[k]) / weightSum));
  // Absorb rounding so the columns add up to the text width exactly.
  widths[widths.length - 1] += TEXT_WIDTH - labelWidth - widths.reduce((a, b) => a + b, 0);
  return { keys, labelWidth, widths };
}

function sectionTable(section: NursingSheetSection, kits: string[]) {
  const { keys, labelWidth, widths } = sectionColumns(section);
  const spanAll = 1 + keys.length;

  const firstHeader =
    section.includeKits && kits.length > 0 ? `Kit ${kits.join(" / ")}` : section.firstColumnHeader;

  const rows: TableRow[] = [];

  if (section.timepoint) {
    rows.push(
      new TableRow({
        children: [
          tableCell(TEXT_WIDTH, [p(section.timepoint, { bold: true, size: MEDIUM, align: AlignmentType.CENTER })], {
            shading: GREY_BAND,
            columnSpan: spanAll,
          }),
        ],
      }),
    );
  }

  rows.push(
    new TableRow({
      children: [
        tableCell(labelWidth, [p(firstHeader, { bold: true, size: MEDIUM })], { shading: GREY_HEAD, center: true }),
        ...keys.map((k, i) =>
          tableCell(widths[i], [p(COLUMN_TITLES[k], { bold: true, align: AlignmentType.CENTER })], {
            shading: GREY_HEAD,
            center: true,
          }),
        ),
      ],
    }),
  );

  for (const row of section.rows) {
    // A note has a natural home in the observations column; without one it
    // goes under the label instead.
    const noteInObservations = section.columns.observations && row.note;
    const labelParagraphs = [p(row.label, { bold: true, align: AlignmentType.CENTER })];
    if (row.note && !noteInObservations) {
      labelParagraphs.push(p(row.note, { align: AlignmentType.CENTER, size: 20 }));
    }

    for (let reading = 0; reading < row.readings; reading++) {
      rows.push(
        new TableRow({
          height: { value: ROW_HEIGHT, rule: HeightRule.ATLEAST },
          children: [
            // The label spans all of this row's measurement lines; docx adds
            // the continuation cells for the lines below it.
            // (No span at all for a single line: rowSpan 1 still opens a merge.)
            ...(reading === 0
              ? [
                  tableCell(labelWidth, labelParagraphs, {
                    rowSpan: row.readings > 1 ? row.readings : undefined,
                    center: true,
                  }),
                ]
              : []),
            ...keys.map((k, i) =>
              tableCell(widths[i], [
                k === "observations" && reading === 0 && noteInObservations
                  ? p(row.note, { bold: true })
                  : new Paragraph({ children: [] }),
              ]),
            ),
          ],
        }),
      );
    }
  }

  return new Table({
    width: { size: TEXT_WIDTH, type: WidthType.DXA },
    columnWidths: [labelWidth, ...widths],
    layout: TableLayoutType.FIXED,
    rows,
  });
}

/**
 * Reproduces the site's paper nursing record ("Documento fonte – Registos de
 * enfermagem"): title over a blue rule, an IP / Site / Protocol line, an
 * identification box (visit, date, patient number, initials) with the visit
 * and patient already filled in, then the visit type's sections as tables to
 * fill in by hand, an optional signature box, the visit's kits and notes, and
 * "Protocol …" plus the page number in the footer.
 */
export async function generateNursingSheetDocx(
  header: NursingSheetDocxHeader,
  sheet: NursingSheet,
): Promise<Buffer> {
  const protocolWithVersion = `${header.protocolId}${header.protocolVersion ? `, ${header.protocolVersion}` : ""}`;
  const footerText = `Protocol ${protocolWithVersion}${
    header.protocolReleaseDate
      ? `, ${header.protocolReleaseDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
      : ""
  }`;

  // Kits appear inside a section that asks for them; if none does, they're
  // listed under the tables like on the checklist.
  const kitsShownInTable = sheet.sections.some((s) => s.includeKits) && header.kits.length > 0;

  const ID_WIDTHS = [1800, 2000, 1300, 1500];
  const idRow = (labelA: string, valueA: string, labelB: string, valueB: string) =>
    new TableRow({
      height: { value: 500, rule: HeightRule.ATLEAST },
      children: [
        tableCell(ID_WIDTHS[0], [p(labelA, { bold: true, size: MEDIUM })], { center: true }),
        tableCell(ID_WIDTHS[1], [p(valueA, { bold: true, size: MEDIUM, align: AlignmentType.CENTER })], { center: true }),
        tableCell(ID_WIDTHS[2], [p(labelB, { bold: true, size: MEDIUM })], { center: true }),
        tableCell(ID_WIDTHS[3], [p(valueB, { bold: true, size: MEDIUM, align: AlignmentType.CENTER })], { center: true }),
      ],
    });

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: BODY } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            margin: { top: 567, bottom: 1134, left: SIDE_MARGIN, right: SIDE_MARGIN, footer: 850 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: [
                  { type: TabStopType.CENTER, position: TEXT_WIDTH / 2 },
                  { type: TabStopType.RIGHT, position: TEXT_WIDTH },
                ],
                children: [new TextRun({ children: [new Tab(), footerText, new Tab(), PageNumber.CURRENT] })],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { bottom: BLUE_RULE },
            spacing: { after: sheet.subtitle ? 60 : 120 },
            children: [
              new TextRun({
                text: sheet.subtitle ? "Documento fonte" : "Documento fonte – Registos de enfermagem",
                bold: true,
                smallCaps: true,
                size: BIG,
              }),
            ],
          }),
          ...(sheet.subtitle
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  border: { bottom: BLUE_RULE },
                  spacing: { after: 120 },
                  children: [
                    new TextRun({
                      text: `Registos de enfermagem - ${sheet.subtitle}`,
                      bold: true,
                      smallCaps: true,
                      size: BIG,
                    }),
                  ],
                }),
              ]
            : []),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 360 },
            children: [
              new TextRun({
                text: `IP: ${header.piName ?? "____________"}   Site Nº: ${header.siteNumber ?? "_____"}   Protocolo Nº: ${header.protocolId}`,
                size: MEDIUM,
              }),
            ],
          }),

          new Table({
            alignment: AlignmentType.CENTER,
            width: { size: ID_WIDTHS.reduce((a, b) => a + b, 0), type: WidthType.DXA },
            columnWidths: ID_WIDTHS,
            layout: TableLayoutType.FIXED,
            rows: [
              idRow(`${sheet.visitLabel}:`, header.visitType, "Data:", header.actualDate ? formatDateTime(header.actualDate).slice(0, 10) : ""),
              idRow("Nº Paciente:", header.subjectCode, "Iniciais:", header.initials ?? ""),
            ],
          }),

          ...sheet.sections.flatMap((section) => [
            new Paragraph({
              indent: { left: 425 },
              spacing: { before: 480, after: 160 },
              children: [new TextRun({ text: `⇒ ${section.title}`, bold: true, size: BIG })],
            }),
            sectionTable(section, header.kits),
            ...(section.footnote
              ? [new Paragraph({ spacing: { before: 60 }, indent: { left: 200 }, children: [new TextRun({ text: section.footnote })] })]
              : []),
          ]),

          ...(sheet.signature
            ? [
                new Paragraph({ spacing: { before: 600 }, children: [] }),
                new Table({
                  width: { size: TEXT_WIDTH, type: WidthType.DXA },
                  columnWidths: [TEXT_WIDTH - 2400, 2400],
                  layout: TableLayoutType.FIXED,
                  rows: [
                    new TableRow({
                      children: [
                        tableCell(TEXT_WIDTH - 2400, [p("Assinatura", { bold: true, size: MEDIUM })], {
                          shading: { type: ShadingType.CLEAR, color: "auto", fill: "D9D9D9" },
                        }),
                        tableCell(2400, [p("Data", { bold: true, size: MEDIUM, align: AlignmentType.CENTER })], {
                          shading: { type: ShadingType.CLEAR, color: "auto", fill: "D9D9D9" },
                        }),
                      ],
                    }),
                    new TableRow({
                      height: { value: 900, rule: HeightRule.ATLEAST },
                      children: [
                        tableCell(TEXT_WIDTH - 2400, [new Paragraph({ children: [] })]),
                        tableCell(2400, [new Paragraph({ children: [] })]),
                      ],
                    }),
                  ],
                }),
              ]
            : []),

          ...(kitsShownInTable ? [] : kitsParagraphs(header.kits)),
          ...notesParagraphs(header.notes),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
