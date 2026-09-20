import { NextResponse } from "next/server";
import { withTenantContext, type TenantContext } from "@/lib/db-context";
import { buildIcs, loadFeedVisits, readFeedToken } from "@/lib/calendar-feed";

// The calendar subscription URL Apple / Google / Outlook poll. There is no
// login here — the signed token in the URL is the credential (see
// src/lib/calendar-feed.ts). Like the kit-expiry cron, this reads through the
// normal RLS-bound client with an explicit tenant context, never the owner
// client: the organization comes from the verified token, so it can only ever
// see that organization's visits.
export const dynamic = "force-dynamic";

// One answer for every kind of failure (bad signature, switched off, old link),
// so a guess reveals nothing.
const notFound = () => new NextResponse("Not found", { status: 404 });

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parts = readFeedToken(token.replace(/\.ics$/i, ""));
  if (!parts) return notFound();

  const ctx: TenantContext = {
    userId: parts.userId,
    organizationId: parts.organizationId,
    isPlatformAdmin: false,
    role: "CALENDAR_FEED",
  };

  const visits = await withTenantContext(ctx, async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: parts.userId },
      select: { organizationId: true, calendarFeedEnabled: true, calendarFeedVersion: true },
    });
    if (
      !user ||
      user.organizationId !== parts.organizationId ||
      !user.calendarFeedEnabled ||
      user.calendarFeedVersion !== parts.version
    ) {
      return null;
    }
    return loadFeedVisits(tx);
  });
  if (!visits) return notFound();

  return new NextResponse(buildIcs(visits, new URL(request.url).origin), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="sitewell-visits.ics"',
      "Cache-Control": "no-store",
    },
  });
}
