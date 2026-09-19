import type { Prisma } from "@prisma/client";

/**
 * Sets the PI name (on the study) and site number (on the study's site row,
 * created on first use). Both are printed on the checklist documents; shared
 * by the study page and the visit page so they can't drift apart.
 */
export async function setStudyPiAndSite(
  tx: Prisma.TransactionClient,
  studyId: string,
  piName: string | null,
  siteNumber: string | null,
) {
  const study = await tx.study.update({ where: { id: studyId }, data: { piName } });

  const existingSite = await tx.site.findFirst({ where: { studyId }, orderBy: { createdAt: "asc" } });
  if (existingSite) {
    await tx.site.update({ where: { id: existingSite.id }, data: { siteNumber } });
  } else if (siteNumber) {
    await tx.site.create({
      data: {
        organizationId: study.organizationId,
        studyId,
        name: `${study.protocolId} Site`,
        siteNumber,
      },
    });
  }
}
