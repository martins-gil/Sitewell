import { NextResponse } from "next/server";
import { getVisitChecklist, getVisitChecklistHeader } from "@/lib/queries";
import { generateChecklistDocx } from "@/lib/checklist-docx";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [items, header] = await Promise.all([getVisitChecklist(id), getVisitChecklistHeader(id)]);

  if (items.length === 0) {
    return NextResponse.json({ error: "This visit has no checklist defined." }, { status: 404 });
  }

  const buffer = await generateChecklistDocx(header, items);
  const filename = `${header.subjectCode}-${header.visitType}-checklist.docx`
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
