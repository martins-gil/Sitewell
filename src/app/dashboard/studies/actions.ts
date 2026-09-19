"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { setStudyPiAndSite } from "@/lib/study-details";
import { isStudyColor } from "@/lib/study-colors";

function requireOrgAdmin(ctx: { role: string; isPlatformAdmin: boolean }) {
  if (ctx.role !== "ORG_ADMIN" && !ctx.isPlatformAdmin) {
    throw new Error("Only an org admin can manage studies.");
  }
}

// Value of the department picker meaning "add the department named in newDepartment".
const NEW_DEPARTMENT = "__new__";

function readStudyFields(formData: FormData) {
  const protocolId = String(formData.get("protocolId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const phase = String(formData.get("phase") ?? "").trim() || null;
  const sponsor = String(formData.get("sponsor") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "").trim() || "active";

  if (!protocolId || !title) {
    throw new Error("Protocol ID and title are required.");
  }
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
    if (!name) throw new Error("Enter a name for the new department.");
    const existing = await tx.department.findFirst({
      where: { organizationId, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) return existing.id;
    return (await tx.department.create({ data: { organizationId, name } })).id;
  }
  if (!choice) return null;
  // Only a department of this organization (row-level security hides others).
  const department = await tx.department.findUnique({ where: { id: choice } });
  if (!department) throw new Error("That department no longer exists.");
  return department.id;
}

export async function addStudy(formData: FormData) {
  const ctx = await requireTenantContext();
  requireOrgAdmin(ctx);
  if (!ctx.organizationId) throw new Error("No organization to add this study to.");

  const fields = readStudyFields(formData);

  try {
    await withTenantContext(ctx, async (tx) => {
      const departmentId = await resolveDepartmentId(tx, ctx.organizationId!, formData);
      await tx.study.create({ data: { organizationId: ctx.organizationId!, ...fields, departmentId } });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A study with protocol ID "${fields.protocolId}" already exists.`);
    }
    throw e;
  }

  revalidatePath("/dashboard/studies");
}

// The PI name and site number printed on the checklist documents. Not
// admin-gated (unlike the core study fields below): coordinators are the ones
// who notice a blank PI on a document they're about to print.
export async function updateStudyPiAndSite(studyId: string, formData: FormData) {
  const ctx = await requireTenantContext();
  const piName = String(formData.get("piName") ?? "").trim() || null;
  const siteNumber = String(formData.get("siteNumber") ?? "").trim() || null;

  await withTenantContext(ctx, (tx) => setStudyPiAndSite(tx, studyId, piName, siteNumber));

  revalidatePath(`/dashboard/studies/${studyId}`);
  revalidatePath("/dashboard/visits/[id]", "page");
}

// Core study identity/status fields.
export async function updateStudyCore(studyId: string, formData: FormData) {
  const ctx = await requireTenantContext();
  requireOrgAdmin(ctx);

  const fields = readStudyFields(formData);

  try {
    await withTenantContext(ctx, async (tx) => {
      const study = await tx.study.findUniqueOrThrow({ where: { id: studyId }, select: { organizationId: true } });
      const departmentId = await resolveDepartmentId(tx, study.organizationId, formData);
      await tx.study.update({ where: { id: studyId }, data: { ...fields, departmentId } });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A study with protocol ID "${fields.protocolId}" already exists.`);
    }
    throw e;
  }

  revalidatePath("/dashboard/studies");
  revalidatePath(`/dashboard/studies/${studyId}`);
  revalidatePath(`/dashboard/studies/${studyId}/templates`);
  revalidatePath("/dashboard/visits");
}
