import { NextResponse } from "next/server";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { buildIcs, loadFeedData } from "@/lib/calendar-feed";

// A one-time .ics copy of the visit calendar for the signed-in user (open it to
// import into Apple / Google / Outlook). Unlike the subscription link it isn't
// kept up to date. `?studyId=` limits it to one study.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await requireTenantContext();
  } catch {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const url = new URL(request.url);
  const studyId = url.searchParams.get("studyId") || undefined;
  const visits = await withTenantContext(ctx, (tx) => loadFeedData(tx, { studyId }));

  return new NextResponse(buildIcs(visits, url.origin), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sitewell-visits.ics"',
      "Cache-Control": "no-store",
    },
  });
}
