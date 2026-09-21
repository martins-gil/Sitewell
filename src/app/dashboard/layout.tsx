import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { getExpiringKitAlerts, getKitStockAlerts, getMustChangePassword, getStudies, getUpcomingWeeks } from "@/lib/queries";
import { daysUntil, formatDate, formatDayShort } from "@/lib/format";
import { resolveStudyColors } from "@/lib/study-colors";
import { SignOutButton } from "./sign-out-button";
import { KitExpiryBanner } from "./kit-expiry-banner";
import { UpcomingVisitsBanner, type WeekVisit } from "./upcoming-visits-banner";
import { SidebarNav } from "./sidebar-nav";
import { GlobalSearch } from "./global-search";
import { BrandLogo } from "@/components/brand-logo";
import type { NavIconName } from "@/components/nav-icons";
import { LOGO_SRC } from "@/lib/brand";
import { getT } from "@/lib/i18n/server";
import { getSidebarColor } from "@/lib/preferences-server";
import { SIDEBAR_COLORS } from "@/lib/preferences";

const NAV: { href: string; label: string; icon: NavIconName }[] = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/dashboard/subjects", label: "Patients", icon: "patients" },
  { href: "/dashboard/studies", label: "Studies", icon: "studies" },
  { href: "/dashboard/visits", label: "Visits Schedule", icon: "calendar" },
  { href: "/dashboard/monitoring", label: "Monitoring visits", icon: "monitoring" },
  { href: "/dashboard/kits", label: "Kits Inventory", icon: "kits" },
  { href: "/dashboard/samples", label: "Lab samples", icon: "samples" },
  { href: "/dashboard/documents", label: "Documents", icon: "documents" },
  { href: "/dashboard/help", label: "Help", icon: "help" },
  { href: "/dashboard/feedback", label: "Feedback", icon: "feedback" },
  // Display preferences, Team and Security all live under Settings.
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

/** "Dana Okafor" -> "DO" */
function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? (words[words.length - 1][0] ?? "") : "")).toUpperCase() || "?";
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const t = await getT();
  const session = await auth();
  const sidebarId = await getSidebarColor();
  const sidebar = SIDEBAR_COLORS.find((c) => c.id === sidebarId) ?? SIDEBAR_COLORS[0];
  const darkBar = sidebar.bg !== null;

  // A platform admin has no organization of their own, so there's no "their"
  // kits or visits to warn about.
  const hasOrg = Boolean(session?.user?.organizationId);
  const [kitAlerts, stockAlerts, weeks, studies, mustChangePassword] = hasOrg
    ? await Promise.all([getExpiringKitAlerts(), getKitStockAlerts(), getUpcomingWeeks(), getStudies(), getMustChangePassword()])
    : [[], [], { thisWeek: [], nextWeek: [] }, [], false];

  const expiringKits = kitAlerts.map((k) => ({
    id: k.id,
    name: k.name,
    protocolId: k.study.protocolId,
    expiryLabel: formatDate(k.expiryDate, t.locale),
    daysLeft: k.expiryDate ? daysUntil(k.expiryDate) : 0,
  }));

  const colors = resolveStudyColors(studies);
  const toWeekVisit = (v: (typeof weeks.thisWeek)[number]): WeekVisit => ({
    id: v.id,
    subjectCode: v.subject.subjectCode,
    visitType: v.visitType,
    dayLabel: formatDayShort(v.targetDate, t.locale),
    colorId: colors[v.studyId] ?? "blue",
  });

  const userName = session?.user?.name ?? "";

  return (
    <div className="flex min-h-screen items-start gap-3 p-3 lg:gap-4 lg:p-4">
      {/* A floating panel: labels below the lg breakpoint collapse to icons. */}
      <aside
        style={sidebar.bg ? { backgroundColor: sidebar.bg } : undefined}
        className={`sticky top-3 flex h-[calc(100vh-1.5rem)] w-[4.5rem] shrink-0 flex-col rounded-xl p-3 shadow-[var(--shadow-card)] lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-64 lg:rounded-2xl lg:p-4 ${
          darkBar ? "text-white" : "bg-surface"
        }`}
      >
        {/* The logo tops the sidebar (a small mark stands in for it on the icon rail). */}
        <div className="mb-5 flex items-center justify-center px-1 pt-1 lg:mb-6 lg:justify-start lg:px-2">
          <span
            aria-hidden
            className={`relative inline-block h-8 w-8 shrink-0 rounded-full ${LOGO_SRC ? "lg:hidden" : ""} ${darkBar ? "bg-white/15" : "bg-accent-soft"}`}
          >
            <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-brand-blue" />
            <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full bg-brand-green" />
          </span>
          {LOGO_SRC ? (
            <span className="hidden lg:block">
              <BrandLogo size="sidebar" onDark={darkBar} />
            </span>
          ) : (
            <span className="ml-2.5 hidden text-lg font-semibold tracking-tight lg:inline">{t("SiteWell-ct")}</span>
          )}
        </div>

        <SidebarNav items={NAV.map((item) => ({ href: item.href, label: t(item.label), icon: item.icon }))} dark={darkBar} />

        <div className="mt-3 hidden lg:block">
          <div className={`flex items-center gap-3 rounded-full p-2 ${darkBar ? "bg-white/10" : "bg-neutral-50 dark:bg-neutral-900"}`}>
            <span
              aria-hidden
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                darkBar ? "bg-white text-neutral-900" : "bg-accent-soft text-accent"
              }`}
            >
              {initialsOf(userName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className={`truncate text-sm font-medium ${darkBar ? "text-white" : ""}`}>{userName}</div>
              <div className={`truncate text-xs ${darkBar ? "text-white/60" : "text-neutral-500"}`}>{session?.user?.role}</div>
            </div>
          </div>
          <div className="mt-2 flex justify-end px-1">
            <SignOutButton dark={darkBar} />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:gap-4">
        {(mustChangePassword || kitAlerts.length > 0 || stockAlerts.length > 0 || weeks.thisWeek.length > 0 || weeks.nextWeek.length > 0) && (
          <div className="space-y-3 lg:space-y-4">
            {mustChangePassword && (
              <div
                role="alert"
                className="overflow-hidden rounded-xl border border-amber-300 bg-amber-100 px-5 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
              >
                {t("You're using a temporary password. Choose your own now to keep your account safe.")}{" "}
                <Link href="/dashboard/settings/security" className="font-medium underline">
                  {t("Change password →")}
                </Link>
              </div>
            )}
            <div className="overflow-hidden rounded-xl empty:hidden">
              <KitExpiryBanner
                kits={expiringKits}
                outOfStock={stockAlerts.map((s) => ({ studyId: s.studyId, protocolId: s.protocolId, assigned: s.assigned }))}
              />
            </div>
            <div className="overflow-hidden rounded-xl empty:hidden">
              <UpcomingVisitsBanner thisWeek={weeks.thisWeek.map(toWeekVisit)} nextWeek={weeks.nextWeek.map(toWeekVisit)} />
            </div>
          </div>
        )}

        {/* Just the search, centred and wide; who is signed in lives in the sidebar. */}
        <header className="flex items-center justify-center gap-3 rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-card)] lg:rounded-2xl lg:py-3.5">
          <GlobalSearch />
          {/* The sidebar's user card is hidden on small screens, so sign-out lives here. */}
          <div className="shrink-0 lg:hidden">
            <SignOutButton dark={false} />
          </div>
        </header>

        <main className="min-w-0 flex-1 pb-8 pt-1">{children}</main>
      </div>
    </div>
  );
}
