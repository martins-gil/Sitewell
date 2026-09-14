import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "@/auth.config";
import { prismaAuth } from "@/lib/prisma-auth";
import { verifyPassword } from "@/lib/password";
import { verifyMfaToken } from "@/lib/mfa";

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
        if (!user) return null;

        const validPassword = await verifyPassword(password, user.passwordHash);
        if (!validPassword) return null;

        // Whether MFA is required is surfaced to the client ahead of time by
        // POST /api/login/precheck, so the login form already knows to
        // collect a code. Here we just enforce it: no more special-casing
        // the two failure reasons than an unauthenticated caller needs.
        if (user.mfaEnabled) {
          if (!mfaCode || !user.mfaSecret || !verifyMfaToken(mfaCode, user.mfaSecret)) {
            return null;
          }
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
