import { NextResponse } from "next/server";
import { getMonitoringDocument } from "@/lib/monitoring";
import { generateChecklistDocx } from "@/lib/checklist-docx";

// The monitoring visit's points to verify, printed in the same layout as a visit's
// procedure checklist (header block, numbered grey-banded table, notes, footer),
// in Portuguese like the site's other paper forms.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let doc;
  try {
    doc = await getMonitoringDocument(id);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }
    throw e;
  }
  if (!doc) return NextResponse.json({ error: "Monitoring visit not found." }, { status: 404 });

  const { visit, header } = doc;
  const day = visit.visitDate.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const heading = [`Visita de monitorização — ${day}`, visit.startTime, visit.room ? `Local: ${visit.room}` : null]
    .filter(Boolean)
    .join(" · ");

  const buffer = await generateChecklistDocx(
    {
      visitType: "Visita de monitorização",
      protocolId: header.protocolId,
      protocolVersion: header.protocolVersion,
      protocolReleaseDate: header.protocolReleaseDate,
      piName: header.piName,
      siteNumber: header.siteNumber,
      checklistVersion: null,
      checklistFootnote: null,
      checklistColumn: "VERIFIED",
      kits: [],
      notes: visit.notes,
      heading,
      columnLabels: { order: "Ordem", items: "Pontos a verificar" },
    },
    visit.items.map((item, i) => ({
      sortOrder: i,
      label: item.label,
      detail: item.detail,
      verified: item.verified,
      performedAt: null,
    })),
  );

  const filename = `${header.protocolId}-monitorizacao-${visit.visitDate.toISOString().slice(0, 10)}.docx`
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
