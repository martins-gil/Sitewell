import { PrismaClient, SubjectStatus, VisitStatus, DocumentType, DocumentStatus } from "@prisma/client";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";

// Seeding bypasses row-level security entirely (it's creating the very first
// organization, before any tenant context exists to scope inserts to) — so,
// unlike the rest of the app, it connects as the owner role via DIRECT_URL
// rather than the RLS-bound app_runtime role in DATABASE_URL.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

const DEMO_PASSWORD = "Password123!";

const IE_CRITERIA = [
  "Age 18–65",
  "Confirmed diagnosis per protocol",
  "No prior investigational treatment",
  "Adequate organ function",
  "Able to provide informed consent",
];

const VISIT_TEMPLATE_DEFS = [
  { name: "Screening", targetDayOffset: -14, windowBeforeDays: 7, windowAfterDays: 0, sortOrder: 0 },
  { name: "Baseline / Day 0", targetDayOffset: 0, windowBeforeDays: 0, windowAfterDays: 0, sortOrder: 1 },
  { name: "Week 4", targetDayOffset: 28, windowBeforeDays: 3, windowAfterDays: 3, sortOrder: 2 },
  { name: "Week 12", targetDayOffset: 84, windowBeforeDays: 5, windowAfterDays: 5, sortOrder: 3 },
  { name: "End of Study", targetDayOffset: 168, windowBeforeDays: 7, windowAfterDays: 7, sortOrder: 4 },
];

// Matches the shape of the site's real paper checklist ("DOCUMENTO DE APOIO
// PARA A IP") closely enough to demo the feature meaningfully, without
// reproducing every line of an actual protocol-specific procedure list.
const SCREENING_CHECKLIST = [
  { label: "Registo no IWRS", detail: null },
  { label: "Verificar cumprimento dos critérios de inclusão/exclusão", detail: null },
  { label: "Sinais Vitais", detail: "temperatura, SpO2 e taxa respiratória e peso" },
  { label: "Colheita de sangue e urina para análise central", detail: null },
  { label: "Métodos de contraceção", detail: null },
];

const BASELINE_CHECKLIST = [
  { label: "Registo no IWRS", detail: null },
  { label: "Questionários PROMs", detail: "tablet" },
  { label: "Verificar eDiary", detail: "preenchido ≥4/7 dias nas últimas duas semanas" },
  { label: "Confirmar que não precisou de medicação de SOS", detail: null },
  { label: "Efeitos adversos e medicação concomitante", detail: null },
  { label: "Randomização (IWRS)", detail: null },
  { label: "Dispensa da medicação para tratamento local", detail: null },
  { label: "Peso e altura", detail: null },
  // The asterisk points at the Baseline checklist's footnote (see checklistFootnote).
  { label: "Colheita de sangue* e urina para análise central", detail: null },
];

function weightedStatus(): SubjectStatus {
  const FUNNEL_WEIGHTS: [SubjectStatus, number][] = [
    ["IDENTIFIED", 20],
    ["PRE_SCREENED", 15],
    ["SCREENED", 15],
    ["CONSENTED", 10],
    ["ENROLLED", 30],
    ["SCREEN_FAILED", 6],
    ["WITHDRAWN", 4],
  ];
  const total = FUNNEL_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [status, weight] of FUNNEL_WEIGHTS) {
    if (roll < weight) return status;
    roll -= weight;
  }
  return "IDENTIFIED";
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

async function wipeExistingData() {
  console.log("Wiping existing data...");
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      organizations, users, studies, sites, study_assignments, subjects,
      visit_schedule_templates, visits, documents, feedback_submissions,
      checklist_template_items, visit_checklist_results,
      checklist_task_library, kits, audit_log
    RESTART IDENTITY CASCADE;
  `);
}

async function main() {
  await wipeExistingData();

  console.log("Seeding synthetic demo data...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const org = await prisma.organization.create({
    data: {
      name: "Riverside Clinical Research Network",
      plan: "pilot",
      region: "us-east",
      hostingPreference: "vercel+neon",
    },
  });

  const platformAdmin = await prisma.user.create({
    data: {
      email: "platform-admin@sitepilot.dev",
      passwordHash,
      name: "Sitepilot Platform Admin",
      role: "PLATFORM_ADMIN",
      isPlatformAdmin: true,
      organizationId: null,
    },
  });

  const orgAdmin = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "admin@riverside-research.dev",
      passwordHash,
      name: "Dana Okafor",
      role: "ORG_ADMIN",
    },
  });

  const pi = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "pi@riverside-research.dev",
      passwordHash,
      name: "Dr. Elena Vasquez",
      role: "PI",
    },
  });

  const crc1 = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "crc1@riverside-research.dev",
      passwordHash,
      name: "Maria Chen",
      role: "CRC",
    },
  });

  const crc2 = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "crc2@riverside-research.dev",
      passwordHash,
      name: "James Whitfield",
      role: "CRC",
    },
  });

  // Recreated on every reseed so the account you're actually using to test
  // doesn't get wiped out from under you — same email/password as before.
  const siteUserPasswordHash = await bcrypt.hash("Ensaios2026**", 12);
  const siteUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "site@riverside-research.dev",
      passwordHash: siteUserPasswordHash,
      name: "Site User",
      role: "CRC",
    },
  });

  // protocolVersion / protocolReleaseDate aren't study columns — they go on
  // the study's PROTOCOL document below, which is where the checklist
  // documents read them from.
  const studyDefs = [
    {
      protocolId: "RCN-101",
      title: "A Phase II Study of Compound X in Adults with Condition A",
      phase: "Phase II",
      sponsor: "Meridian Therapeutics",
      protocolVersion: "Amendment 3",
      protocolReleaseDate: new Date("2025-11-04"),
    },
    {
      protocolId: "RCN-204",
      title: "A Phase III Study Evaluating Compound Y vs. Placebo",
      phase: "Phase III",
      sponsor: "Northbridge Biosciences",
      protocolVersion: "Amendment 5",
      protocolReleaseDate: new Date("2026-01-20"),
    },
  ];

  for (const def of studyDefs) {
    const { protocolVersion, protocolReleaseDate, ...studyFields } = def;
    const study = await prisma.study.create({
      data: { organizationId: org.id, ...studyFields, status: "active", piName: pi.name },
    });

    await prisma.site.create({
      data: {
        organizationId: org.id,
        studyId: study.id,
        name: "Riverside Main Site",
        address: "400 Research Pkwy, Riverside",
        siteNumber: "00001",
      },
    });

    const templates = await Promise.all(
      VISIT_TEMPLATE_DEFS.map((t) =>
        prisma.visitScheduleTemplate.create({
          data: {
            organizationId: org.id,
            studyId: study.id,
            ...t,
            // Demonstrates the "(V3)" label and the footnote under the table.
            ...(t.name === "Baseline / Day 0"
              ? {
                  checklistVersion: "V3",
                  checklistFootnote: "*hematologia, BQ, IgEt, amostra para imunogenicidade e PK ou outros biomarcadores exploratórios",
                }
              : {}),
          },
        }),
      ),
    );
    const screeningTemplate = templates.find((t) => t.name === "Screening")!;
    const baselineTemplate = templates.find((t) => t.name === "Baseline / Day 0")!;
    const week4Template = templates.find((t) => t.name === "Week 4")!;

    for (const [i, item] of SCREENING_CHECKLIST.entries()) {
      await prisma.checklistTemplateItem.create({
        data: {
          organizationId: org.id,
          visitScheduleTemplateId: screeningTemplate.id,
          sortOrder: i,
          label: item.label,
          detail: item.detail,
        },
      });
    }
    for (const [i, item] of BASELINE_CHECKLIST.entries()) {
      await prisma.checklistTemplateItem.create({
        data: {
          organizationId: org.id,
          visitScheduleTemplateId: baselineTemplate.id,
          sortOrder: i,
          label: item.label,
          detail: item.detail,
        },
      });
    }

    await prisma.kit.createMany({
      data: [
        {
          organizationId: org.id,
          studyId: study.id,
          visitScheduleTemplateId: screeningTemplate.id,
          name: `${def.protocolId} Screening Lab Kits — Lot A`,
          expiryDate: faker.date.soon({ days: 20 }),
        },
        {
          organizationId: org.id,
          studyId: study.id,
          visitScheduleTemplateId: baselineTemplate.id,
          name: `${def.protocolId} Baseline Blood Draw Kits — Lot B`,
          expiryDate: faker.date.future({ years: 1 }),
        },
        {
          organizationId: org.id,
          studyId: study.id,
          visitScheduleTemplateId: week4Template.id,
          name: `${def.protocolId} Week 4 Kits — Lot C`,
          expiryDate: faker.date.past({ years: 0.05 }),
        },
        {
          organizationId: org.id,
          studyId: study.id,
          visitScheduleTemplateId: null,
          name: `${def.protocolId} General Supply Kit`,
          expiryDate: faker.date.future({ years: 1 }),
        },
      ],
    });

    await Promise.all(
      [crc1, crc2, siteUser, pi].map((u) =>
        prisma.studyAssignment.create({
          data: { organizationId: org.id, userId: u.id, studyId: study.id },
        }),
      ),
    );

    await prisma.document.createMany({
      data: [
        {
          organizationId: org.id,
          studyId: study.id,
          type: DocumentType.PROTOCOL,
          title: `${def.protocolId} Protocol`,
          version: protocolVersion,
          releaseDate: protocolReleaseDate,
          fileUrl: "https://example.com/placeholder/protocol.pdf",
          status: DocumentStatus.ACTIVE,
          signedById: pi.id,
          signedAt: faker.date.past({ years: 1 }),
        },
        {
          organizationId: org.id,
          studyId: study.id,
          type: DocumentType.IB,
          title: `${def.protocolId} Investigator's Brochure`,
          version: "v5.0",
          fileUrl: "https://example.com/placeholder/ib.pdf",
          expiryDate: faker.date.soon({ days: 45 }),
          // Not signed yet, so Pending — status is set by people now, no
          // longer worked out from the missing signature.
          status: DocumentStatus.DRAFT,
        },
        {
          organizationId: org.id,
          studyId: study.id,
          type: DocumentType.ICF,
          title: `${def.protocolId} Informed Consent Form`,
          version: "v2.1",
          fileUrl: "https://example.com/placeholder/icf.pdf",
          status: DocumentStatus.ACTIVE,
          signedById: pi.id,
          signedAt: faker.date.past({ years: 1 }),
        },
        {
          organizationId: org.id,
          studyId: study.id,
          type: DocumentType.DELEGATION_LOG,
          title: `${def.protocolId} Delegation of Authority Log`,
          version: "v1.4",
          fileUrl: "https://example.com/placeholder/delegation-log.pdf",
          status: DocumentStatus.ACTIVE,
          signedById: orgAdmin.id,
          signedAt: faker.date.past({ years: 1 }),
        },
        {
          organizationId: org.id,
          studyId: study.id,
          type: DocumentType.TRAINING_RECORD,
          title: `${def.protocolId} GCP Training — Site Staff`,
          version: "v1.0",
          fileUrl: "https://example.com/placeholder/training.pdf",
          expiryDate: faker.date.past({ years: 0.1 }),
          status: DocumentStatus.EXPIRED,
        },
      ],
    });

    const subjectCount = faker.number.int({ min: 16, max: 24 });
    for (let i = 1; i <= subjectCount; i++) {
      const status = weightedStatus();
      const isEnrolledOrLater = status === "ENROLLED";
      const enrolledAt = isEnrolledOrLater ? faker.date.past({ years: 0.5 }) : null;

      const subject = await prisma.subject.create({
        data: {
          organizationId: org.id,
          studyId: study.id,
          subjectCode: `${def.protocolId}-${String(i).padStart(4, "0")}`,
          status,
          // Synthetic initials only (faker), never a real person's.
          displayName: `${faker.person.firstName()[0]}.${faker.person.lastName()[0]}.`,
          ieCriteriaSnapshot: IE_CRITERIA.map((criterion) => ({
            criterion,
            met: faker.datatype.boolean({ probability: 0.85 }),
          })),
          isTestData: true,
          enrolledAt,
        },
      });

      if (enrolledAt) {
        for (const template of templates) {
          const targetDate = addDays(enrolledAt, template.targetDayOffset);
          const windowStart = addDays(targetDate, -template.windowBeforeDays);
          const windowEnd = addDays(targetDate, template.windowAfterDays);
          const isPastVisit = targetDate.getTime() < Date.now();

          let visitStatus: VisitStatus = "SCHEDULED";
          let actualDate: Date | null = null;
          if (isPastVisit) {
            const roll = Math.random();
            if (roll < 0.75) {
              visitStatus = "COMPLETED";
              actualDate = faker.date.between({ from: windowStart, to: windowEnd });
            } else if (roll < 0.9) {
              visitStatus = "MISSED";
            } else {
              visitStatus = "RESCHEDULED";
            }
          }

          await prisma.visit.create({
            data: {
              organizationId: org.id,
              subjectId: subject.id,
              studyId: study.id,
              templateId: template.id,
              visitType: template.name,
              targetDate,
              windowStart,
              windowEnd,
              actualDate,
              status: visitStatus,
            },
          });
        }
      }
    }

    // Link the Baseline kit to one completed Baseline visit, so a fresh
    // database has a kit that's eligible for "Remove from inventory (used)".
    const completedBaseline = await prisma.visit.findFirst({
      where: { studyId: study.id, templateId: baselineTemplate.id, actualDate: { not: null } },
    });
    if (completedBaseline) {
      await prisma.kit.updateMany({
        where: { studyId: study.id, name: `${def.protocolId} Baseline Blood Draw Kits — Lot B` },
        data: { visitId: completedBaseline.id },
      });
    }
  }

  // Populate the reusable checklist task library from everything just
  // seeded, so the "Add a checklist item" dropdown has real content on a
  // fresh database (mirrors what addChecklistTemplateItem does live).
  const allItems = [...SCREENING_CHECKLIST, ...BASELINE_CHECKLIST];
  const seenLabels = new Set<string>();
  for (const item of allItems) {
    if (seenLabels.has(item.label)) continue;
    seenLabels.add(item.label);
    await prisma.checklistTaskLibrary.create({
      data: { organizationId: org.id, label: item.label, detail: item.detail },
    });
  }

  console.log("\nSeed complete.\n");
  console.log("Demo organization: Riverside Clinical Research Network");
  console.log(`Shared demo password for all seeded users: ${DEMO_PASSWORD}\n`);
  console.log("Accounts:");
  for (const u of [platformAdmin, orgAdmin, pi, crc1, crc2]) {
    console.log(`  ${u.role.padEnd(15)} ${u.email}`);
  }
  console.log(`  ${siteUser.role.padEnd(15)} ${siteUser.email}  (password: Ensaios2026**)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
