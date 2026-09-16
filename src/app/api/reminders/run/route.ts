import { NextResponse } from "next/server";
import { runDueReminders } from "@/lib/reminders";

// Manually triggerable for the demo (see the "Send due reminders" button on
// /dashboard/visits). In production this is what a scheduled job (Vercel
// Cron, etc.) would hit instead of a person clicking a button.
export async function POST() {
  const count = await runDueReminders();
  return NextResponse.json({ remindersSent: count });
}
