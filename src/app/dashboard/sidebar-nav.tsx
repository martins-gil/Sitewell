"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { NavIcon, type NavIconName } from "@/components/nav-icons";

/**
 * The sidebar links. The page you're on is a dark pill (a light one in the dark theme). Clicking the section you're already on refreshes it: a link to the
 * address you're at does nothing by itself, so without this the data on the page stays
 * as it was until you switched sections and came back. (If the address carries
 * filters — /patients?study=… — the click is a normal navigation, which clears them.)
 */
export function SidebarNav({
  items,
}: {
  items: { href: string; label: string; icon: NavIconName; badge?: number }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
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
            title={item.label}
            className={`flex items-center justify-center gap-3 rounded-full px-0 py-2.5 text-sm lg:justify-start lg:px-3.5 ${
              active
                ? "bg-neutral-900 font-medium text-white shadow-sm dark:bg-white dark:text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
            } ${refreshing && pathname === item.href ? "animate-pulse" : ""}`}
          >
            <span className="relative shrink-0">
              <NavIcon name={item.icon} className="h-[18px] w-[18px]" />
              {!!item.badge && (
                <span
                  aria-hidden
                  className={`absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-semibold lg:hidden ${
                    active ? "bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white" : "bg-accent text-white"
                  }`}
                >
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </span>
            <span className="hidden flex-1 truncate lg:inline">{item.label}</span>
            {!!item.badge && (
              <span
                className={`hidden shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold lg:inline ${
                  active ? "bg-white/20" : "bg-accent text-white"
                }`}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
