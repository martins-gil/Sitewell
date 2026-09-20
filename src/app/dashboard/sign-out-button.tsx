"use client";

import { signOut } from "next-auth/react";
import { useT } from "@/lib/i18n/client";

export function SignOutButton({ dark = false }: { dark?: boolean }) {
  const t = useT();
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={`mt-2 underline ${
        dark ? "text-white/70 hover:text-white" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      }`}
    >
      {t("Sign out")}
    </button>
  );
}
