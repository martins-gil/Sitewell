import { NextResponse } from "next/server";
import { getVisitChecklistHeader } from "@/lib/queries";
import { generateNursingSheetDocx } from "@/lib/nursing-sheet-docx";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const header = await getVisitChecklistHeader(id);

  const buffer = await generateNursingSheetDocx(header, header.nursingSheet);
  const filename = `${header.subjectCode}-${header.visitType}-nursing-sheet.docx`
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
