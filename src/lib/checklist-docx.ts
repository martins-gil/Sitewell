import { formatDateTime } from "@/lib/format";
import { kitsParagraphs, notesParagraphs, textLines } from "@/lib/docx-blocks";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

export type ChecklistDocxItem = {
  sortOrder: number;
  label: string;
  detail: string | null;
  verified: boolean;
  performedAt: Date | null;
};

export type ChecklistDocxHeader = {
  visitType: string;
  protocolId: string;
  protocolVersion: string | null;
  protocolReleaseDate: Date | null;
  piName: string | null;
  siteNumber: string | null;
  checklistVersion: string | null;
  checklistFootnote: string | null;
  // Last column: a tick ("Verificado") or when it was done ("Data/hora").
  checklistColumn: "VERIFIED" | "DATETIME";
  // Kits linked to this visit, listed under the table.
  kits: string[];
  // The coordinator's free-text notes for this visit.
  notes: string | null;
  // The same document laid out for something other than a patient visit (a
  // monitoring visit's points to verify): its own heading instead of "Ordem de
  // procedimentos <visit>", and its own names for the first two columns.
  heading?: string;
  columnLabels?: { order: string; items: string };
};

// A4 with 3 cm side margins, measured off the site's own template (the "V3"
// document): the table spans exactly the text width.
const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const SIDE_MARGIN = 1701;
const TEXT_WIDTH = PAGE_WIDTH - 2 * SIDE_MARGIN;
const COLUMN_WIDTHS = [1701, 5570, TEXT_WIDTH - 1701 - 5570];
// With a "Data/hora" last column the date needs room, like the site's
// extension-visit form: a narrow number column, a wide date one.
const DATETIME_COLUMN_WIDTHS = [1400, 5000, TEXT_WIDTH - 1400 - 5000];

const GRID = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const SHADED = { type: ShadingType.CLEAR, color: "auto", fill: "F2F2F2" };

// Half-points (22 = 11pt). Sizes measured against the site's template.
const BODY = 22;
const HEADING_ROW = 24;
const TITLE = 32;
const SECTION_HEADING = 28;
const PI_COLUMN = 2200;

function cell(width: number, paragraphs: Paragraph[], shaded: boolean) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: { top: GRID, bottom: GRID, left: GRID, right: GRID },
    shading: shaded ? SHADED : undefined,
    children: paragraphs,
  });
}

function headerCell(width: number, text: string) {
  return cell(
    width,
    [new Paragraph({ children: [new TextRun({ text, bold: true, size: HEADING_ROW })] })],
    false,
  );
}

function formatReleaseDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Reproduces the site's paper checklist ("DOCUMENTO DE APOIO PARA A IP", the
 * V3 template): small-caps title over a thin blue rule; a PI / Site Nº /
 * Protocol Nº line; "Ordem de procedimentos <visit> (V3)"; a three-column
 * table with a plain header row, alternating grey rows, bold numbers and
 * bold labels with the detail in regular weight; a footnote; and the
 * protocol / version / release date centred in the page footer. Steps the
 * coordinator has checked off in the app get a tick in "Verificado".
 */
export async function generateChecklistDocx(
  header: ChecklistDocxHeader,
  items: ChecklistDocxItem[],
): Promise<Buffer> {
  const widths = header.checklistColumn === "DATETIME" ? DATETIME_COLUMN_WIDTHS : COLUMN_WIDTHS;
  const versionLabel = header.checklistVersion?.trim().replace(/^\((.*)\)$/, "$1");
  const protocolWithVersion = `${header.protocolId}${header.protocolVersion ? `, ${header.protocolVersion}` : ""}`;
  const footerText = `Protocol ${protocolWithVersion}${
    header.protocolReleaseDate ? `, ${formatReleaseDate(header.protocolReleaseDate)}` : ""
  }`;

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
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: footerText })] }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "5B9BD5", space: 4 } },
            spacing: { after: 120 },
            children: [
              new TextRun({ text: "Documento de apoio para a IP", bold: true, smallCaps: true, size: TITLE }),
            ],
          }),

          new Table({
            width: { size: TEXT_WIDTH, type: WidthType.DXA },
            columnWidths: [PI_COLUMN, TEXT_WIDTH - PI_COLUMN],
            layout: TableLayoutType.FIXED,
            borders: {
              top: NONE,
              bottom: NONE,
              left: NONE,
              right: NONE,
              insideHorizontal: NONE,
              insideVertical: NONE,
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: PI_COLUMN, type: WidthType.DXA },
                    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
                    children: [
                      new Paragraph({
                        indent: { left: 425 },
                        children: [new TextRun({ text: `PI: ${header.piName ?? "____________"}`, size: HEADING_ROW })],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: TEXT_WIDTH - PI_COLUMN, type: WidthType.DXA },
                    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Site Nº: ${header.siteNumber ?? "_____"}   Protocol Nº: ${protocolWithVersion}`,
                            size: HEADING_ROW,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 360, after: 160 },
            children: [
              new TextRun({
                text: header.heading ?? `Ordem de procedimentos ${header.visitType}${versionLabel ? ` (${versionLabel})` : ""}`,
                bold: true,
                smallCaps: true,
                size: SECTION_HEADING,
              }),
            ],
          }),

          new Table({
            width: { size: TEXT_WIDTH, type: WidthType.DXA },
            columnWidths: widths,
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  headerCell(widths[0], header.columnLabels?.order ?? "Ordem das avaliações"),
                  headerCell(widths[1], header.columnLabels?.items ?? "Avaliações"),
                  headerCell(widths[2], header.checklistColumn === "DATETIME" ? "Data/hora" : "Verificado"),
                ],
              }),
              ...items.map((item, i) => {
                const shaded = i % 2 === 0;
                return new TableRow({
                  children: [
                    cell(
                      widths[0],
                      [new Paragraph({ children: [new TextRun({ text: String(i + 1), bold: true })] })],
                      shaded,
                    ),
                    cell(
                      widths[1],
                      [
                        new Paragraph({
                          alignment: AlignmentType.JUSTIFIED,
                          children: [
                            new TextRun({ text: item.label, bold: true }),
                            ...(item.detail ? [new TextRun({ text: ` (${item.detail})` })] : []),
                          ],
                        }),
                      ],
                      shaded,
                    ),
                    cell(
                      widths[2],
                      [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            header.checklistColumn === "DATETIME"
                              ? new TextRun({ text: formatDateTime(item.performedAt), size: 20 })
                              : new TextRun({ text: item.verified ? "✓" : "", bold: true }),
                          ],
                        }),
                      ],
                      shaded,
                    ),
                  ],
                });
              }),
            ],
          }),

          ...kitsParagraphs(header.kits),

          ...(header.checklistFootnote?.trim() ? textLines(header.checklistFootnote, 480) : []),

          ...notesParagraphs(header.notes),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
