import { NextResponse } from "next/server";
import { getSubjectIeForm } from "@/lib/queries";
import { generateIeDocx } from "@/lib/ie-docx";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ?visitId= fills in the form's VISIT box (it's re-checked at each visit).
  const visitId = new URL(request.url).searchParams.get("visitId");

  let data;
  try {
    data = await getSubjectIeForm(id, visitId);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }
    throw e;
  }
  if (!data) return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  if (data.inclusion.length + data.exclusion.length === 0) {
    return NextResponse.json({ error: "This patient has no I/E criteria yet." }, { status: 404 });
  }

  const buffer = await generateIeDocx(data);
  const filename = `${data.subjectCode}${data.visitName ? `-${data.visitName}` : ""}-IE-criteria.docx`.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
