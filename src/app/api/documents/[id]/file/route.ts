import { NextResponse } from "next/server";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { readStoredFile } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let ctx;
  try {
    ctx = await requireTenantContext();
  } catch {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  // Looking the row up through withTenantContext is what actually enforces
  // access here — RLS means this returns null for a document in another
  // organization even though we're querying by id alone, before we ever
  // touch the filesystem.
  const document = await withTenantContext(ctx, (tx) =>
    tx.document.findUnique({ where: { id }, select: { fileUrl: true, title: true } }),
  );

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!document.fileUrl) {
    return NextResponse.json({ error: "No file has been attached to this document." }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readStoredFile(document.fileUrl);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Keep the uploaded file's own name (and so its .pdf / .docx extension): the
  // stored key is `<org>/<uuid>-<original name>`. The title is the fallback.
  const storedName = document.fileUrl.split("/").pop()?.slice(37) ?? "";
  const filename = (storedName || document.title).replace(/["\\\r\n]/g, "");

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
