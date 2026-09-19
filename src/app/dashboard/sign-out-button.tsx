"use client";

import { signOut } from "next-auth/react";
import { useT } from "@/lib/i18n/client";

export function SignOutButton() {
  const t = useT();
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="mt-2 text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
    >
      {t("Sign out")}</button>
  );
}
