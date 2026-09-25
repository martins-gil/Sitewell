import { NextResponse } from "next/server";
import { runSampleShipmentConfirmations } from "@/lib/sample-confirm-emails";

// Hit once a day in the afternoon by Vercel Cron (see vercel.json — 15:00 UTC; move that
// schedule if you want a different local time). Same auth as the other cron routes:
// `Authorization: Bearer <CRON_SECRET>`, which Vercel sends automatically when the
// CRON_SECRET env var is set on the project; with no CRON_SECRET configured it refuses to
// run at all rather than being callable by anyone who finds the URL.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSampleShipmentConfirmations();
  return NextResponse.json(result);
}
