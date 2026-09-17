import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
} from "docx";

export type ChecklistDocxItem = {
  sortOrder: number;
  label: string;
  detail: string | null;
  verified: boolean;
};

export type ChecklistDocxHeader = {
  visitType: string;
  protocolId: string;
  protocolAmendment: string | null;
  subjectCode: string;
  piName: string | null;
  siteNumber: string | null;
};

const HEADER_CELL_SHADING = { type: ShadingType.SOLID, color: "F0F0F0", fill: "F0F0F0" };

function headerCell(text: string, width: number) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: HEADER_CELL_SHADING,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
  });
}

/**
 * Reproduces the layout of the site's existing paper checklist (see the
 * attached "DOCUMENTO DE APOIO PARA A IP" sample): a title, a PI/Site/
 * Protocol header line, "ORDEM DE PROCEDIMENTOS <visit>," and a 3-column
 * table of ordered steps with a Verificado column — filled in with ✓ where
 * the coordinator has already checked that step off in the app.
 */
export async function generateChecklistDocx(
  header: ChecklistDocxHeader,
  items: ChecklistDocxItem[],
): Promise<Buffer> {
  const amendmentSuffix = header.protocolAmendment ? `, ${header.protocolAmendment}` : "";

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "DOCUMENTO DE APOIO PARA A IP", bold: true, size: 28 })],
          }),
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" } },
            spacing: { after: 200 },
            children: [
              new TextRun({ text: `PI: ${header.piName ?? "____________"}    ` }),
              new TextRun({ text: `Site Nº: ${header.siteNumber ?? "_____"}   ` }),
              new TextRun({ text: `Protocol Nº: ${header.protocolId}${amendmentSuffix}` }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({ text: `ORDEM DE PROCEDIMENTOS ${header.visitType.toUpperCase()}`, bold: true }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: `Subject: ${header.subjectCode}`, italics: true })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  headerCell("Ordem das avaliações", 15),
                  headerCell("Avaliações", 70),
                  headerCell("Verificado", 15),
                ],
              }),
              ...items.map(
                (item, i) =>
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph({ children: [new TextRun(String(i + 1))] })],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: item.label, bold: true }),
                              ...(item.detail ? [new TextRun({ text: ` (${item.detail})` })] : []),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: item.verified ? "✓" : "", bold: true })],
                          }),
                        ],
                      }),
                    ],
                  }),
              ),
            ],
          }),
          new Paragraph({
            spacing: { before: 400 },
            children: [
              new TextRun({
                text: `Protocol ${header.protocolId}${amendmentSuffix}, generated ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`,
                italics: true,
                size: 18,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
