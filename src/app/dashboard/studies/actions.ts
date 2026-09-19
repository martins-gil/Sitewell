"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { setStudyPiAndSite } from "@/lib/study-details";

function requireOrgAdmin(ctx: { role: string; isPlatformAdmin: boolean }) {
  if (ctx.role !== "ORG_ADMIN" && !ctx.isPlatformAdmin) {
    throw new Error("Only an org admin can manage studies.");
  }
}

function readStudyFields(formData: FormData) {
  const protocolId = String(formData.get("protocolId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const phase = String(formData.get("phase") ?? "").trim() || null;
  const sponsor = String(formData.get("sponsor") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "").trim() || "active";

  if (!protocolId || !title) {
    throw new Error("Protocol ID and title are required.");
  }
  return { protocolId, title, phase, sponsor, status };
}

export async function addStudy(formData: FormData) {
  const ctx = await requireTenantContext();
  requireOrgAdmin(ctx);
  if (!ctx.organizationId) throw new Error("No organization to add this study to.");

  const fields = readStudyFields(formData);

  try {
    await withTenantContext(ctx, (tx) =>
      tx.study.create({ data: { organizationId: ctx.organizationId!, ...fields } }),
    );
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
    await withTenantContext(ctx, (tx) => tx.study.update({ where: { id: studyId }, data: fields }));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A study with protocol ID "${fields.protocolId}" already exists.`);
    }
    throw e;
  }

  revalidatePath("/dashboard/studies");
  revalidatePath(`/dashboard/studies/${studyId}/templates`);
}
