import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

export function proxy(...args: Parameters<typeof auth>) {
  return (auth as (...a: Parameters<typeof auth>) => ReturnType<typeof auth>)(...args);
}

export const config = {
  // Everything except static assets and the NextAuth API routes themselves.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
