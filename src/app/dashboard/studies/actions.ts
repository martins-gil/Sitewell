"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { setStudyPiAndSite } from "@/lib/study-details";
import { isStudyColor } from "@/lib/study-colors";
import { cleanCriteria, criteriaDraftSchema, type CriteriaDraft } from "@/lib/text-import";

function requireOrgAdmin(ctx: { role: string; isPlatformAdmin: boolean }) {
  if (ctx.role !== "ORG_ADMIN" && !ctx.isPlatformAdmin) {
    throw new Error("Only an org admin can manage studies.");
  }
}

// What the study forms get back. A thrown error would reach the browser as a masked
// "Server Components render" message in production, so anything a person can fix is a
// code here and the form words it (translated) itself — see study-problems.ts.
export type StudyProblem = "MISSING" | "DUPLICATE" | "DEPARTMENT_NAME" | "DEPARTMENT_GONE";
export type StudyResult = { ok: true } | { ok: false; problem: StudyProblem };

// Thrown from inside a transaction so a refusal undoes the whole save.
class StudyRefused extends Error {
  constructor(public problem: StudyProblem) {
    super(problem);
  }
}

// Value of the department picker meaning "add the department named in newDepartment".
const NEW_DEPARTMENT = "__new__";

function readStudyFields(formData: FormData) {
  const protocolId = String(formData.get("protocolId") ?? "").trim();
  // The full title is optional: a study is usually known by its acronym (the protocol
  // ID) alone, and that is what a blank title becomes.
  const title = String(formData.get("title") ?? "").trim() || protocolId;
  const phase = String(formData.get("phase") ?? "").trim() || null;
  const sponsor = String(formData.get("sponsor") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "").trim() || "active";

  if (!protocolId) throw new StudyRefused("MISSING");
  const color = String(formData.get("color") ?? "");
  return { protocolId, title, phase, sponsor, status, color: isStudyColor(color) ? color : null };
}

// The department picked in the form: an existing one, a new one (created here,
// or reused if one with that name already exists), or none.
async function resolveDepartmentId(
  tx: Prisma.TransactionClient,
  organizationId: string,
  formData: FormData,
): Promise<string | null> {
  const choice = String(formData.get("departmentId") ?? "");
  if (choice === NEW_DEPARTMENT) {
    const name = String(formData.get("newDepartment") ?? "").trim();
    if (!name) throw new StudyRefused("DEPARTMENT_NAME");
    const existing = await tx.department.findFirst({
      where: { organizationId, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) return existing.id;
    return (await tx.department.create({ data: { organizationId, name } })).id;
  }
  if (!choice) return null;
  // Only a department of this organization (row-level security hides others).
  const department = await tx.department.findUnique({ where: { id: choice } });
  if (!department) throw new StudyRefused("DEPARTMENT_GONE");
  return department.id;
}

/** Turns what a study save threw into a result, or lets a real failure through. */
function studyFailure(e: unknown): StudyResult {
  if (e instanceof StudyRefused) return { ok: false, problem: e.problem };
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return { ok: false, problem: "DUPLICATE" };
  }
  throw e;
}

export async function addStudy(formData: FormData): Promise<StudyResult> {
  const ctx = await requireTenantContext();
  requireOrgAdmin(ctx);
  if (!ctx.organizationId) throw new Error("No organization to add this study to.");

  try {
    const fields = readStudyFields(formData);
    await withTenantContext(ctx, async (tx) => {
      const departmentId = await resolveDepartmentId(tx, ctx.organizationId!, formData);
      await tx.study.create({ data: { organizationId: ctx.organizationId!, ...fields, departmentId } });
    });
  } catch (e) {
    return studyFailure(e);
  }

  revalidatePath("/dashboard/studies");
  return { ok: true };
}

// The PI name and site number printed on the checklist documents. Not
// admin-gated (unlike the core study fields below): coordinators are the ones
// who notice a blank PI on a document they're about to print.
export async function updateStudyPiAndSite(studyId: string, formData: FormData) {
  const ctx = await requireTenantContext();
  const piName = String(formData.get("piName") ?? "").trim() || null;
  const siteNumber = String(formData.get("siteNumber") ?? "").trim() || null;
  // Printed only on the I/E form. Left alone when the form didn't send it.
  const euCtNumber = formData.has("euCtNumber") ? String(formData.get("euCtNumber") ?? "").trim().slice(0, 60) || null : undefined;

  await withTenantContext(ctx, async (tx) => {
    await setStudyPiAndSite(tx, studyId, piName, siteNumber);
    if (euCtNumber !== undefined) await tx.study.update({ where: { id: studyId }, data: { euCtNumber } });
  });

  revalidatePath(`/dashboard/studies/${studyId}`);
  revalidatePath("/dashboard/visits/[id]", "page");
}

// Core study identity/status fields.
export async function updateStudyCore(studyId: string, formData: FormData): Promise<StudyResult> {
  const ctx = await requireTenantContext();
  requireOrgAdmin(ctx);

  try {
    const fields = readStudyFields(formData);
    await withTenantContext(ctx, async (tx) => {
      const study = await tx.study.findUniqueOrThrow({ where: { id: studyId }, select: { organizationId: true } });
      const departmentId = await resolveDepartmentId(tx, study.organizationId, formData);
      await tx.study.update({ where: { id: studyId }, data: { ...fields, departmentId } });
    });
  } catch (e) {
    return studyFailure(e);
  }

  revalidatePath("/dashboard/studies");
  revalidatePath(`/dashboard/studies/${studyId}`);
  revalidatePath(`/dashboard/studies/${studyId}/templates`);
  revalidatePath("/dashboard/visits");
  return { ok: true };
}

/** Saves the study's inclusion / exclusion criteria (from pasted text or typed
 * in). Open to everyone, like the PI name on the same page. Returns a result
 * rather than throwing so the form can say what went wrong. */
export async function saveStudyCriteria(studyId: string, draft: CriteriaDraft): Promise<{ ok: boolean }> {
  const ctx = await requireTenantContext();
  const parsed = criteriaDraftSchema.safeParse({
    inclusion: draft.inclusion.map((s) => s.trim()).filter(Boolean),
    exclusion: draft.exclusion.map((s) => s.trim()).filter(Boolean),
  });
  if (!parsed.success) return { ok: false };
  const clean = cleanCriteria(parsed.data);

  await withTenantContext(ctx, (tx) =>
    tx.study.update({
      where: { id: studyId },
      data: { ieCriteria: clean.inclusion.length + clean.exclusion.length > 0 ? clean : Prisma.DbNull },
    }),
  );
  revalidatePath(`/dashboard/studies/${studyId}`);
  revalidatePath("/dashboard/subjects/[id]", "page");
  return { ok: true };
}