"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="mt-2 text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
    >
      Sign out
    </button>
  );
}
