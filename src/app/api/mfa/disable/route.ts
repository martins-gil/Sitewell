import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { verifyMfaToken } from "@/lib/mfa";

const schema = z.object({ code: z.string().min(6).max(6) });

// Requires a valid current code to disable — otherwise a hijacked, already-
// logged-in session could turn MFA off silently.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid code format." }, { status: 400 });
  }

  const ctx = await requireTenantContext();

  const disabled = await withTenantContext(ctx, async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { mfaSecret: true },
    });
    if (!user.mfaSecret || !verifyMfaToken(parsed.data.code, user.mfaSecret)) {
      return false;
    }
    await tx.user.update({
      where: { id: ctx.userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    return true;
  });

  if (!disabled) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
