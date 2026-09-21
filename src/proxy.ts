import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

export function proxy(...args: Parameters<typeof auth>) {
  return (auth as (...a: Parameters<typeof auth>) => ReturnType<typeof auth>)(...args);
}

export const config = {
  // Everything except static assets and API routes. API routes are excluded
  // entirely (not just api/auth) because the redirect-to-/login behavior in
  // auth.config.ts's `authorized` callback turns an unauthenticated fetch()
  // into a 302 to an HTML page instead of a JSON response, which breaks
  // every client-side `await res.json()` call (found by actually testing
  // login — see /api/login/precheck). Each API route enforces its own auth
  // via requireTenantContext() instead.
  // public/brand/ holds the logo and the sign-in pictures, which the sign-in page shows to
  // people who are not signed in.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brand/).*)"],
};
