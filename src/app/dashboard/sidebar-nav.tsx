"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * The sidebar links. Clicking the section you're already on refreshes it: a
 * link to the address you're at does nothing by itself, so without this the
 * data on the page stays as it was until you switched sections and came back.
 * (If the address carries filters — /patients?study=… — the click is a normal
 * navigation, which clears them.)
 */
export function SidebarNav({ items, dark }: { items: { href: string; label: string }[]; dark: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((item) => {
        const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={(e) => {
              if (pathname === item.href && window.location.search === "") {
                e.preventDefault();
                startTransition(() => router.refresh());
              }
            }}
            className={`rounded-md px-2 py-1.5 text-sm ${
              dark
                ? active
                  ? "bg-white/15 font-medium text-white"
                  : "text-white/80 hover:bg-white/10"
                : active
                  ? "bg-neutral-200 font-medium text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-800"
                  : "text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
            } ${refreshing && pathname === item.href ? "animate-pulse" : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
