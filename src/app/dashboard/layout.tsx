import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { SignOutButton } from "./sign-out-button";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/subjects", label: "Patients" },
  { href: "/dashboard/studies", label: "Studies" },
  { href: "/dashboard/visits", label: "Visits Schedule" },
  { href: "/dashboard/kits", label: "Kits" },
  { href: "/dashboard/documents", label: "Documents" },
  { href: "/dashboard/feedback", label: "Feedback" },
  { href: "/dashboard/settings/security", label: "Security" },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-56 flex-col border-r border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mb-6 px-2 text-lg font-semibold tracking-tight">SiteWell-ct</div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-neutral-200 pt-3 text-xs text-neutral-500 dark:border-neutral-800">
          <div className="truncate font-medium text-neutral-700 dark:text-neutral-300">
            {session?.user?.name}
          </div>
          <div className="truncate">{session?.user?.role}</div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
