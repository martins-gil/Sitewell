import type { IeFormData } from "@/lib/queries";
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

// Same page, margins, fonts and table look as the checklist ("Documento de
// apoio para a IP"): A4, 3 cm sides, title over a thin blue rule, a PI / Site /
// Protocol line, grey banded rows, protocol + version + date in the footer. The
// wording is Portuguese like the site's other paper forms.
const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const SIDE_MARGIN = 1701;
const TEXT_WIDTH = PAGE_WIDTH - 2 * SIDE_MARGIN;
const NUMBER_COLUMN = 850;
const ANSWER_COLUMN = 900;
const COLUMN_WIDTHS = [NUMBER_COLUMN, TEXT_WIDTH - NUMBER_COLUMN - 2 * ANSWER_COLUMN, ANSWER_COLUMN, ANSWER_COLUMN];

const GRID = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const SHADED = { type: ShadingType.CLEAR, color: "auto", fill: "F2F2F2" };

const BODY = 22;
const HEADING_ROW = 24;
const TITLE = 32;
const SECTION_HEADING = 28;
const PI_COLUMN = 2200;
const SYMBOL_FONT = "Segoe UI Symbol";

function cell(width: number, paragraphs: Paragraph[], shaded: boolean) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: { top: GRID, bottom: GRID, left: GRID, right: GRID },
    shading: shaded ? SHADED : undefined,
    children: paragraphs,
  });
}

function headerCell(width: number, text: string, centered = false) {
  return cell(
    width,
    [
      new Paragraph({
        alignment: centered ? AlignmentType.CENTER : undefined,
        children: [new TextRun({ text, bold: true, size: HEADING_ROW })],
      }),
    ],
    false,
  );
}

/** A ticked or empty box. `true` = this column is the recorded answer. */
function box(checked: boolean) {
  return new TextRun({ text: checked ? "☒" : "☐", font: SYMBOL_FONT, size: 26 });
}

function answerCell(width: number, checked: boolean, shaded: boolean) {
  return cell(width, [new Paragraph({ alignment: AlignmentType.CENTER, children: [box(checked)] })], shaded);
}

function formatReleaseDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function criteriaTable(title: string, prefix: string, list: IeFormData["inclusion"]) {
  return new Table({
    width: { size: TEXT_WIDTH, type: WidthType.DXA },
    columnWidths: COLUMN_WIDTHS,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: [
          headerCell(COLUMN_WIDTHS[0], "Nº"),
          headerCell(COLUMN_WIDTHS[1], title),
          headerCell(COLUMN_WIDTHS[2], "Sim", true),
          headerCell(COLUMN_WIDTHS[3], "Não", true),
        ],
      }),
      ...(list.length === 0
        ? [
            new TableRow({
              children: [
                cell(COLUMN_WIDTHS[0], [new Paragraph({ children: [] })], false),
                cell(COLUMN_WIDTHS[1], [new Paragraph({ children: [new TextRun({ text: "—" })] })], false),
                cell(COLUMN_WIDTHS[2], [new Paragraph({ children: [] })], false),
                cell(COLUMN_WIDTHS[3], [new Paragraph({ children: [] })], false),
              ],
            }),
          ]
        : list.map((item, i) => {
            const shaded = i % 2 === 0;
            return new TableRow({
              cantSplit: true,
              children: [
                cell(
                  COLUMN_WIDTHS[0],
                  [new Paragraph({ children: [new TextRun({ text: `${prefix}${i + 1}`, bold: true })] })],
                  shaded,
                ),
                cell(
                  COLUMN_WIDTHS[1],
                  [new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: item.text })] })],
                  shaded,
                ),
                answerCell(COLUMN_WIDTHS[2], item.met === true, shaded),
                answerCell(COLUMN_WIDTHS[3], item.met === false, shaded),
              ],
            });
          })),
    ],
  });
}

/**
 * The eligibility (I/E) criteria as a paper source document: an inclusion table
 * and an exclusion table, each row with Sim / Não boxes, then the investigator's
 * conclusion, date and signature. A patient's copy has the recorded answers
 * ticked (a criterion not yet assessed is left blank); the study's copy is a
 * blank form. Sim / Não always answers the criterion as written, so on an
 * exclusion criterion "Sim" means it applies to the subject. The conclusion
 * boxes are never pre-ticked — eligibility is the investigator's call.
 */
export async function generateIeDocx(data: IeFormData): Promise<Buffer> {
  const protocolWithVersion = `${data.protocolId}${data.protocolVersion ? `, ${data.protocolVersion}` : ""}`;
  const footerText = `Protocol ${protocolWithVersion}${
    data.protocolReleaseDate ? `, ${formatReleaseDate(data.protocolReleaseDate)}` : ""
  }`;
  const subjectLine = `Sujeito Nº: ${data.subjectCode ?? "_______________"}   Iniciais: ${data.initials ?? "________"}`;

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
                        children: [new TextRun({ text: `PI: ${data.piName ?? "____________"}`, size: HEADING_ROW })],
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
                            text: `Site Nº: ${data.siteNumber ?? "_____"}   Protocol Nº: ${protocolWithVersion}`,
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
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({ text: "Critérios de elegibilidade", bold: true, smallCaps: true, size: SECTION_HEADING }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: subjectLine, size: HEADING_ROW })],
          }),

          criteriaTable("Critérios de inclusão", "I", data.inclusion),
          new Paragraph({ spacing: { before: 240 }, children: [] }),
          criteriaTable("Critérios de exclusão", "E", data.exclusion),

          new Paragraph({
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({ text: "O sujeito cumpre todos os critérios de inclusão e nenhum de exclusão:   " }),
              box(false),
              new TextRun({ text: " Sim    " }),
              box(false),
              new TextRun({ text: " Não" }),
            ],
          }),
          new Paragraph({
            spacing: { before: 360 },
            children: [
              new TextRun({ text: "Data: ____/____/________     Assinatura do investigador: ______________________________" }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
