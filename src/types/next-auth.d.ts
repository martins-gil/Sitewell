import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organizationId: string | null;
      role: string;
      isPlatformAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    organizationId: string | null;
    role: string;
    isPlatformAdmin: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    organizationId: string | null;
    role: string;
    isPlatformAdmin: boolean;
  }
}
