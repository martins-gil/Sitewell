"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireTenantContext, withTenantContext } from "@/lib/db-context";

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

// Core study identity/status fields — kept separate from
// updateStudyDocumentDetails in ./[id]/templates/actions.ts, which owns the
// fields printed on the generated checklist .docx header.
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
