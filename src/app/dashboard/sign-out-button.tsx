"use client";

import { signOut } from "next-auth/react";
import { useT } from "@/lib/i18n/client";

export function SignOutButton({ dark = false }: { dark?: boolean }) {
  const t = useT();
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        dark
          ? "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
      }`}
    >
      {t("Sign out")}
    </button>
  );
}
