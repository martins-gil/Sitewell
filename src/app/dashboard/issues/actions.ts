"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";

// What the add-issue form gets back. A thrown error would reach the browser as a masked
// "Server Components render" message in production, so this always returns a result.
export type IssueProblem = "MISSING_TEXT";
export type IssueResult = { ok: true; id: string } | { ok: false; problem: IssueProblem };

function refresh() {
  revalidatePath("/dashboard/issues");
  revalidatePath("/dashboard/issues/history");
}

/** Adds a pending issue: the text, and optionally the study it's about. */
export async function addPendingIssue(formData: FormData): Promise<IssueResult> {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) throw new Error("No organization to add this to.");

  const text = String(formData.get("text") ?? "").trim().slice(0, 2000);
  const studyId = String(formData.get("studyId") ?? "").trim() || null;
  if (!text) return { ok: false, problem: "MISSING_TEXT" };

  const created = await withTenantContext(ctx, (tx) =>
    tx.pendingIssue.create({ data: { organizationId: ctx.organizationId!, studyId, text } }),
  );
  refresh();
  return { ok: true, id: created.id };
}

/** Ticks an issue off — a soft "resolved" (it moves to the History page, it isn't deleted). */
export async function resolvePendingIssue(id: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) =>
    tx.pendingIssue.update({ where: { id }, data: { resolved: true, resolvedAt: new Date() } }),
  );
  refresh();
}

/** Undoes a tick from the History page — the issue is open again. */
export async function reopenPendingIssue(id: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) =>
    tx.pendingIssue.update({ where: { id }, data: { resolved: false, resolvedAt: null } }),
  );
  refresh();
}

/** Removes an issue outright (a mistaken entry) — unlike resolving, this doesn't keep it
 * in the history. */
export async function deletePendingIssue(id: string) {
  const ctx = await requireTenantContext();
  await withTenantContext(ctx, (tx) => tx.pendingIssue.delete({ where: { id } }));
  refresh();
}
