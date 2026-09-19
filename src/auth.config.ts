import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe half of the NextAuth config: no providers that touch Prisma
 * (Prisma's Node bindings don't run in the Edge middleware runtime), so this
 * is the part middleware.ts imports. src/auth.ts adds the Credentials
 * provider on top of this for use in route handlers / server components,
 * which do run under Node.
 */
export default {
  // Signed out automatically after 8 hours, however active the session is.
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = request.nextUrl.pathname.startsWith("/login");
      if (isLoginPage) {
        return isLoggedIn ? Response.redirect(new URL("/dashboard", request.nextUrl)) : true;
      }
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
