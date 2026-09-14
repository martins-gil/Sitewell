import { NextResponse } from "next/server";
import { z } from "zod";
import { prismaAuth } from "@/lib/prisma-auth";

const schema = z.object({ email: z.string().email() });

// Tells the login form whether to show an MFA field, without revealing
// whether the account exists at all (unknown emails just get mfaRequired: false).
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ mfaRequired: false });
  }

  const user = await prismaAuth.user.findUnique({
    where: { email: parsed.data.email },
    select: { mfaEnabled: true },
  });

  return NextResponse.json({ mfaRequired: user?.mfaEnabled ?? false });
}
