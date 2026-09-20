import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { getExpiringKitAlerts, getMustChangePassword, getStudies, getUpcomingWeeks } from "@/lib/queries";
import { daysUntil, formatDate, formatDayShort } from "@/lib/format";
import { resolveStudyColors } from "@/lib/study-colors";
import { SignOutButton } from "./sign-out-button";
import { KitExpiryBanner } from "./kit-expiry-banner";
import { UpcomingVisitsBanner, type WeekVisit } from "./upcoming-visits-banner";
import { SidebarNav } from "./sidebar-nav";
import { GlobalSearch } from "./global-search";
import { getT } from "@/lib/i18n/server";
import { getSidebarColor } from "@/lib/preferences-server";
import { SIDEBAR_COLORS } from "@/lib/preferences";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/subjects", label: "Patients" },
  { href: "/dashboard/studies", label: "Studies" },
  { href: "/dashboard/visits", label: "Visits Schedule" },
  { href: "/dashboard/kits", label: "Kits Inventory" },
  { href: "/dashboard/documents", label: "Documents" },
  { href: "/dashboard/help", label: "Help" },
  { href: "/dashboard/feedback", label: "Feedback" },
  // Display preferences, Team and Security all live under Settings.
  { href: "/dashboard/settings", label: "Settings" },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const t = await getT();
  const session = await auth();
  const sidebarId = await getSidebarColor();
  const sidebar = SIDEBAR_COLORS.find((c) => c.id === sidebarId) ?? SIDEBAR_COLORS[0];
  const darkBar = sidebar.bg !== null;

  // A platform admin has no organization of their own, so there's no "their"
  // kits or visits to warn about.
  const hasOrg = Boolean(session?.user?.organizationId);
  const [kitAlerts, weeks, studies, mustChangePassword] = hasOrg
    ? await Promise.all([getExpiringKitAlerts(), getUpcomingWeeks(), getStudies(), getMustChangePassword()])
    : [[], { thisWeek: [], nextWeek: [] }, [], false];

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

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {mustChangePassword && (
        <div
          role="alert"
          className="border-b border-amber-300 bg-amber-100 px-6 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          {t("You're using a temporary password. Choose your own now to keep your account safe.")}{" "}
          <Link href="/dashboard/settings/security" className="font-medium underline">
            {t("Change password →")}
          </Link>
        </div>
      )}
      <KitExpiryBanner kits={expiringKits} />
      <UpcomingVisitsBanner thisWeek={weeks.thisWeek.map(toWeekVisit)} nextWeek={weeks.nextWeek.map(toWeekVisit)} />
      <div className="flex flex-1">
      <aside
        style={sidebar.bg ? { backgroundColor: sidebar.bg } : undefined}
        className={`flex w-56 shrink-0 flex-col border-r p-4 ${
          darkBar
            ? "border-white/10 text-white"
            : "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950"
        }`}
      >
        <div className="mb-6 px-2 text-lg font-semibold tracking-tight">{t("SiteWell-ct")}</div>
        <SidebarNav items={NAV.map((item) => ({ href: item.href, label: t(item.label) }))} dark={darkBar} />
        <div
          className={`border-t pt-3 text-xs ${
            darkBar ? "border-white/10 text-white/60" : "border-neutral-200 text-neutral-500 dark:border-neutral-800"
          }`}
        >
          <div
            className={`truncate font-medium ${darkBar ? "text-white" : "text-neutral-700 dark:text-neutral-300"}`}
          >
            {session?.user?.name}
          </div>
          <div className="truncate">{session?.user?.role}</div>
          <SignOutButton dark={darkBar} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-neutral-200 px-8 py-3 dark:border-neutral-800">
          <GlobalSearch />
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
      </div>
    </div>
  );
}
