import type { IeFormData } from "@/lib/queries";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  TabStopType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

// The site's "Checklist for verification of inclusion and exclusion criteria"
// (a SOURCE DOCUMENT), reproduced from its template: a "Source Document"
// header with the PI / Site / Protocol line; the visit and patient box;
// Table 1 (inclusion) and Table 2 (exclusion) with Yes / No / NA / Comments;
// the "is the patient eligible" line; the investigator's confirmation with a
// Signature / Date box; and a footer with the NA note, page number and
// "STUDY … | Version … | EU CT …, date". In English, like the template.

const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const SIDE_MARGIN = 1418;
const TEXT_WIDTH = PAGE_WIDTH - 2 * SIDE_MARGIN;

// Nº | criterion | Yes | No | NA | Comments
const COLUMNS = [600, 4693, 720, 590, 567, 1900];
const ID_COLUMNS = [1900, 2500];
const ELIGIBLE_COLUMNS = [TEXT_WIDTH - 2 * 1835, 1835, 1835];
const SIGNATURE_COLUMNS = [5700, TEXT_WIDTH - 5700];

const LINE = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const GREY_TEXT = "7F7F7F";
const HEADER_FILL = { type: ShadingType.CLEAR, color: "auto", fill: "D9D9D9" };

// Half-points (20 = 10pt).
const BODY = 20;
const SMALL = 16;

const CENTER = AlignmentType.CENTER;

function cell(
  width: number,
  children: Paragraph[],
  options: { fill?: typeof HEADER_FILL; middle?: boolean } = {},
) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: { top: LINE, bottom: LINE, left: LINE, right: LINE },
    shading: options.fill,
    verticalAlign: options.middle ? VerticalAlign.CENTER : undefined,
    children,
  });
}

function text(value: string, options: { bold?: boolean; smallCaps?: boolean; size?: number; center?: boolean } = {}) {
  return new Paragraph({
    alignment: options.center ? CENTER : undefined,
    children: [new TextRun({ text: value, bold: options.bold, smallCaps: options.smallCaps, size: options.size ?? BODY })],
  });
}

const blank = () => new Paragraph({ children: [] });

/** A tick for the recorded answer's column, empty otherwise. */
function tick(on: boolean) {
  return new Paragraph({ alignment: CENTER, children: [new TextRun({ text: on ? "✓" : "", bold: true, size: BODY })] });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
}

function criteriaTable(title: string, naHeader: string, list: IeFormData["inclusion"]) {
  const header = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      cell(COLUMNS[0], [text("Nº", { bold: true })]),
      cell(COLUMNS[1], [text(title, { bold: true })]),
      cell(COLUMNS[2], [text("Yes", { bold: true, center: true })]),
      cell(COLUMNS[3], [text("No", { bold: true, center: true })]),
      cell(COLUMNS[4], [text(naHeader, { bold: true, center: true })]),
      cell(COLUMNS[5], [text("Comments", { bold: true })]),
    ],
  });

  // With no criteria yet, one empty row keeps the printout usable by hand.
  const rows =
    list.length === 0
      ? [
          new TableRow({
            cantSplit: true,
            children: COLUMNS.map((width) => cell(width, [blank()])),
          }),
        ]
      : list.map(
          (item, i) =>
            new TableRow({
              cantSplit: true,
              children: [
                cell(COLUMNS[0], [text(String(i + 1), { center: true })]),
                cell(COLUMNS[1], [
                  new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: item.text, size: BODY })] }),
                ]),
                cell(COLUMNS[2], [tick(item.met === true)]),
                cell(COLUMNS[3], [tick(item.met === false)]),
                cell(COLUMNS[4], [blank()]),
                cell(COLUMNS[5], [blank()]),
              ],
            }),
        );

  return new Table({
    width: { size: TEXT_WIDTH, type: WidthType.DXA },
    columnWidths: COLUMNS,
    layout: TableLayoutType.FIXED,
    rows: [header, ...rows],
  });
}

/**
 * Yes / No answer the criterion as written, so on an exclusion criterion "Yes"
 * means it applies to the patient. A patient's copy ticks what was recorded in
 * the app (a criterion not yet assessed stays blank); NA, the comments, the
 * eligibility line and the signature are always left for the investigator.
 */
export async function generateIeDocx(data: IeFormData): Promise<Buffer> {
  const blankLine = "________";
  const version = data.protocolVersion?.trim();
  const footerStudy = [
    `STUDY ${data.protocolId}`,
    ...(version ? [/^\d/.test(version) ? `Version ${version}` : version] : []),
    `${data.euCtNumber ? `EU CT ${data.euCtNumber}` : ""}${
      data.euCtNumber && data.protocolReleaseDate ? ", " : ""
    }${data.protocolReleaseDate ? formatDate(data.protocolReleaseDate) : ""}`,
  ]
    .filter((part) => part.trim() !== "")
    .join(" | ");

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: BODY } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            margin: { top: 1701, bottom: 1418, left: SIDE_MARGIN, right: SIDE_MARGIN, header: 567, footer: 567 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: CENTER,
                children: [new TextRun({ text: "Source Document", bold: true, smallCaps: true, size: 26 })],
              }),
              new Paragraph({
                alignment: CENTER,
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "A6A6A6", space: 4 } },
                spacing: { after: 120 },
                children: [
                  new TextRun({
                    text: `PI: ${data.piName ?? blankLine}   Site Nº: ${data.siteNumber ?? blankLine}   Protocol Nº: ${data.protocolId}`,
                    color: GREY_TEXT,
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH }],
                children: [
                  new TextRun({
                    text: "* When not applicable (NA) justify in the comments column if relevant",
                    bold: true,
                    color: GREY_TEXT,
                    size: SMALL,
                  }),
                  new TextRun({ text: "\t", size: SMALL }),
                  new TextRun({ children: [PageNumber.CURRENT], color: GREY_TEXT, size: SMALL }),
                ],
              }),
              new Paragraph({
                alignment: CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: "9DC3E6", space: 4 } },
                spacing: { before: 80 },
                children: [new TextRun({ text: footerStudy, color: GREY_TEXT, size: SMALL })],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: CENTER,
            spacing: { before: 120, after: 160 },
            children: [
              new TextRun({
                text: "Checklist for verification of inclusion and exclusion criteria",
                bold: true,
                smallCaps: true,
                size: 18,
              }),
            ],
          }),

          new Table({
            width: { size: ID_COLUMNS[0] + ID_COLUMNS[1], type: WidthType.DXA },
            columnWidths: ID_COLUMNS,
            alignment: CENTER,
            layout: TableLayoutType.FIXED,
            rows: [
              ["Visit:", data.visitName],
              ["Patient Nº:", data.subjectCode],
              ["Patient initials:", data.initials],
            ].map(
              ([label, value]) =>
                new TableRow({
                  cantSplit: true,
                  children: [
                    cell(ID_COLUMNS[0], [text(label ?? "", { bold: true, smallCaps: true, size: 18 })]),
                    cell(ID_COLUMNS[1], [text(value ?? "", { smallCaps: true, center: true, size: 18 })]),
                  ],
                }),
            ),
          }),

          new Paragraph({
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({
                text: "Table 1: Inclusion criteria. To be enrolled into the study, subjects must meet all of the following inclusion criteria.",
                bold: true,
                size: BODY,
              }),
            ],
          }),
          criteriaTable("Inclusion Criteria:", "NA*", data.inclusion),

          new Paragraph({
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({
                text: "Table 2: Exclusion criteria. The presence of any of the following criteria excludes a participant from participating in the study:",
                bold: true,
                size: BODY,
              }),
            ],
          }),
          criteriaTable("Exclusion Criteria:", "NA", data.exclusion),

          new Paragraph({ spacing: { before: 240 }, children: [] }),
          new Table({
            width: { size: TEXT_WIDTH, type: WidthType.DXA },
            columnWidths: ELIGIBLE_COLUMNS,
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({
                cantSplit: true,
                height: { value: 400, rule: HeightRule.ATLEAST },
                children: [
                  cell(ELIGIBLE_COLUMNS[0], [text("Is the patient eligible for study participation at this visit:")], { middle: true }),
                  cell(ELIGIBLE_COLUMNS[1], [text("YES", { center: true })], { middle: true }),
                  cell(ELIGIBLE_COLUMNS[2], [text("NO", { center: true })], { middle: true }),
                ],
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 360, after: 240 },
            children: [
              new TextRun({
                text: "Herein I confirm that I checked the inclusion and exclusion criteria as specified above and I verified the criteria assessable at today's visit against the source documents of the patient.",
                size: BODY,
              }),
            ],
          }),

          new Table({
            width: { size: TEXT_WIDTH, type: WidthType.DXA },
            columnWidths: SIGNATURE_COLUMNS,
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  cell(SIGNATURE_COLUMNS[0], [text("Signature", { bold: true, center: true })], { fill: HEADER_FILL }),
                  cell(SIGNATURE_COLUMNS[1], [text("Date", { bold: true, center: true })], { fill: HEADER_FILL }),
                ],
              }),
              new TableRow({
                cantSplit: true,
                height: { value: 700, rule: HeightRule.ATLEAST },
                children: [cell(SIGNATURE_COLUMNS[0], [blank()]), cell(SIGNATURE_COLUMNS[1], [blank()])],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
