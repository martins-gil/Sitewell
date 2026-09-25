import { requireTenantContext, withTenantContext } from "@/lib/db-context";

// Pending issues: a running to-do list of things to track down and fix, each optionally
// tied to a study (a site-wide issue has none). Ticking one off is a soft "resolved" —
// see src/app/dashboard/issues/actions.ts — so nothing is lost; the History page
// (/dashboard/issues/history) lists what was resolved, grouped by week and month.

export type IssueFilters = { studyId?: string };

/** Still open, newest first. */
export async function getPendingIssues(filters: IssueFilters = {}) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.pendingIssue.findMany({
      where: { resolved: false, studyId: filters.studyId || undefined },
      include: { study: { select: { protocolId: true, title: true } } },
      orderBy: { createdAt: "desc" },
    }),
  );
}

/** How many are still open — for the sidebar badge. */
export async function getPendingIssueCount() {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) => tx.pendingIssue.count({ where: { resolved: false } }));
}

/** Resolved, most recently resolved first — the History page groups these by week/month. */
export async function getResolvedIssues(filters: IssueFilters = {}) {
  const ctx = await requireTenantContext();
  return withTenantContext(ctx, (tx) =>
    tx.pendingIssue.findMany({
      where: { resolved: true, studyId: filters.studyId || undefined },
      include: { study: { select: { protocolId: true, title: true } } },
      orderBy: { resolvedAt: "desc" },
    }),
  );
}
