import { NextResponse } from "next/server";
import { runKitExpiryEmails } from "@/lib/kit-reminders";

// Hit daily by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET env var is set
// on the project. There's no logged-in user here, so this is the route's only
// auth: with no CRON_SECRET configured it refuses to run at all rather than
// being callable by anyone who finds the URL.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runKitExpiryEmails();
  return NextResponse.json(result);
}
