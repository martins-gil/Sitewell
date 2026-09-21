"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

/** Sub-navigation of the Settings area. Team is only offered to org admins. */
export function SettingsTabs({ canManageTeam }: { canManageTeam: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const tabs = [
    { href: "/dashboard/settings", label: t("Preferences") },
    { href: "/dashboard/settings/notifications", label: t("Notifications") },
    ...(canManageTeam ? [{ href: "/dashboard/settings/team", label: t("Team") }] : []),
    { href: "/dashboard/settings/security", label: t("Security") },
  ];

  return (
    <nav className="mb-6 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            // Clicking the tab you're on refreshes it (a link to the same address does nothing).
            onClick={(e) => {
              if (active) {
                e.preventDefault();
                router.refresh();
              }
            }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              active
                ? "border-neutral-900 font-medium text-neutral-900 dark:border-white dark:text-white"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
