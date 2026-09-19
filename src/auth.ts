import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "@/auth.config";
import { prismaAuth } from "@/lib/prisma-auth";
import { spendPasswordCheckTime, verifyPassword } from "@/lib/password";
import { verifyMfaToken } from "@/lib/mfa";

// Sign-in throttling: this many wrong attempts in a row lock the account for a
// while. Every kind of failure (wrong password, wrong code, unknown email,
// locked account) looks the same from outside, so it can't be used to find out
// which emails have accounts.
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Password" },
        mfaCode: { label: "MFA code" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        const mfaCode = credentials?.mfaCode as string | undefined;
        if (!email || !password) return null;

        const user = await prismaAuth.user.findUnique({ where: { email } });
        if (!user) {
          await spendPasswordCheckTime(password);
          return null;
        }
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        // Whether MFA is required is surfaced to the client ahead of time by
        // POST /api/login/precheck, so the login form already knows to
        // collect a code. Here we just enforce it: no more special-casing
        // the two failure reasons than an unauthenticated caller needs.
        const validPassword = await verifyPassword(password, user.passwordHash);
        const validCode =
          !user.mfaEnabled || (!!mfaCode && !!user.mfaSecret && verifyMfaToken(mfaCode, user.mfaSecret));

        if (!validPassword || !validCode) {
          const failed = user.failedLoginCount + 1;
          await prismaAuth.user.update({
            where: { id: user.id },
            data:
              failed >= MAX_FAILED_LOGINS
                ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) }
                : { failedLoginCount: failed },
          });
          return null;
        }

        if (user.failedLoginCount > 0 || user.lockedUntil) {
          await prismaAuth.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: user.organizationId,
          role: user.role,
          isPlatformAdmin: user.isPlatformAdmin,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id as string;
        token.organizationId = (user as { organizationId: string | null }).organizationId;
        token.role = (user as { role: string }).role;
        token.isPlatformAdmin = (user as { isPlatformAdmin: boolean }).isPlatformAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.organizationId = token.organizationId as string | null;
      session.user.role = token.role as string;
      session.user.isPlatformAdmin = token.isPlatformAdmin as boolean;
      return session;
    },
  },
});
