import { NextResponse } from "next/server";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { generateMfaSecret, getMfaOtpAuthUrl, getMfaQrCodeDataUrl } from "@/lib/mfa";

// Generates a new TOTP secret and stores it against the user, but does NOT
// enable MFA yet — /api/mfa/verify does that once the user proves they can
// generate a matching code, so a half-finished setup never locks anyone out.
export async function POST() {
  const ctx = await requireTenantContext();

  const secret = generateMfaSecret();
  const { email } = await withTenantContext(ctx, async (tx) => {
    const user = await tx.user.update({
      where: { id: ctx.userId },
      data: { mfaSecret: secret, mfaEnabled: false },
      select: { email: true },
    });
    return user;
  });

  const otpAuthUrl = getMfaOtpAuthUrl(email, secret);
  const qrCodeDataUrl = await getMfaQrCodeDataUrl(otpAuthUrl);

  return NextResponse.json({ secret, qrCodeDataUrl });
}
