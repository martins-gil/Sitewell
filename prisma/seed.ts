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

const REFERRAL_SOURCES = [
  "Physician referral",
  "Online advertisement",
  "Patient registry",
  "Word of mouth",
  "Community event",
  "Site database",
];

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

const FUNNEL_WEIGHTS: [SubjectStatus, number][] = [
  ["IDENTIFIED", 20],
  ["PRE_SCREENED", 15],
  ["SCREENED", 15],
  ["CONSENTED", 10],
  ["ENROLLED", 30],
  ["SCREEN_FAILED", 6],
  ["WITHDRAWN", 4],
];

function weightedStatus(): SubjectStatus {
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

async function main() {
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

  const site = await prisma.site.create({
    data: { organizationId: org.id, name: "Riverside Main Site", address: "400 Research Pkwy, Riverside" },
  });

  const studyDefs = [
    { protocolId: "RCN-101", title: "A Phase II Study of Compound X in Adults with Condition A", phase: "Phase II", sponsor: "Meridian Therapeutics" },
    { protocolId: "RCN-204", title: "A Phase III Study Evaluating Compound Y vs. Placebo", phase: "Phase III", sponsor: "Northbridge Biosciences" },
  ];

  for (const def of studyDefs) {
    const study = await prisma.study.create({
      data: { organizationId: org.id, ...def, status: "active" },
    });

    await prisma.site.update({ where: { id: site.id }, data: { studyId: study.id } }).catch(() => {});

    const templates = await Promise.all(
      VISIT_TEMPLATE_DEFS.map((t) =>
        prisma.visitScheduleTemplate.create({
          data: { organizationId: org.id, studyId: study.id, ...t },
        }),
      ),
    );

    await Promise.all(
      [crc1, crc2, pi].map((u) =>
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
          version: "v3.0",
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
          status: DocumentStatus.ACTIVE,
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
          referralSource: faker.helpers.arrayElement(REFERRAL_SOURCES),
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
          const isPast = targetDate.getTime() < Date.now();

          let visitStatus: VisitStatus = "SCHEDULED";
          let actualDate: Date | null = null;
          if (isPast) {
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
  }

  console.log("\nSeed complete.\n");
  console.log("Demo organization: Riverside Clinical Research Network");
  console.log(`Shared demo password for all seeded users: ${DEMO_PASSWORD}\n`);
  console.log("Accounts:");
  for (const u of [platformAdmin, orgAdmin, pi, crc1, crc2]) {
    console.log(`  ${u.role.padEnd(15)} ${u.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
