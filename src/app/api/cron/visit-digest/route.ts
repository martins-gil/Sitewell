import { NextResponse } from "next/server";
import { runVisitDigest } from "@/lib/visit-digest";

// Hit by Vercel Cron on Wednesdays and Thursdays (see vercel.json), which sends
// `Authorization: Bearer <CRON_SECRET>`. Like the kit-expiry job there is no
// logged-in user, so the secret is the only protection, and with no CRON_SECRET
// configured the route refuses to run at all.
//   ?force=1  runs on any day and ignores the "already sent" guard, for trying it out.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  return NextResponse.json(await runVisitDigest({ force }));
}
