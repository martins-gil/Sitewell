import { NextResponse } from "next/server";
import { getStudyIeForm } from "@/lib/queries";
import { generateIeDocx } from "@/lib/ie-docx";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data;
  try {
    data = await getStudyIeForm(id);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }
    throw e;
  }
  if (!data) return NextResponse.json({ error: "Study not found." }, { status: 404 });
  if (data.inclusion.length + data.exclusion.length === 0) {
    return NextResponse.json({ error: "This study has no I/E criteria yet." }, { status: 404 });
  }

  const buffer = await generateIeDocx(data);
  const filename = `${data.protocolId}-IE-criteria.docx`.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
