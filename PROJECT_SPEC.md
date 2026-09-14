# Clinical Trial Site Platform — Commercial MVP Spec (v2)

**Status:** Draft v2 — pivoted from internal tool to commercial product
**Target markets:** US, EU, and Asia (broad for now — narrow to 1–2 specific
countries per region once you're past the prototype stage; regulatory regimes
differ a lot even within "Asia")
**Priority right now:** get a working, testable prototype in front of real
coordinators fast — not full commercial hardening. That gate comes later,
explicitly, in Phase 5.
**Scope:** Recruitment tracking + visit scheduling (CTMS core) + eISF/regulatory
documents, multi-tenant from the data model up
**Deliberately deferred:** SClinico/EHR integration, AI/ML patient matching,
full 21 CFR Part 11 e-signature, SOC 2 / HIPAA certification — all real work,
none of it blocks testing the core workflow

---

## 0. IP & Differentiation Notes (carry these into every phase)

From the earlier patent/trademark scan — nothing here should slow down
building the prototype, but keep them in mind as you write code:

- Don't wire visit scheduling directly into an auto-generated investigator
  payment budget the way older Medidata patents (US7054823) claim it — a
  plain date-offset ± window calculator is fine and is what's in Module 2 below.
- Don't build the specific "visit time passes → auto-generate reminder to
  file a report" trigger from US20120101837A1 verbatim; a generic N-days
  reminder (already in the spec) is a different, unremarkable mechanism.
- No AI/EHR-based patient matching in this build — that's the one actively-
  patented corner of this space (Verana Health, Deep 6, etc.) and deserves
  its own freedom-to-operate check before it's ever built, not now.
- Pick a working product name and run a quick self-check against EUIPO,
  INPI Portugal, and USPTO trademark search before it's baked into the repo
  name, domain, or UI — cheap to check now, annoying to rename later.
- US market materially raises patent exposure vs. EU-only (software patents
  are easier to obtain/enforce in the US). Nothing to do about that today —
  just don't treat "it works in the EU" as clearing you for the US without
  a real FTO search before commercial launch there.

---

## 1. Purpose

A commercial platform for study coordinators to manage patient recruitment,
protocol visits, and regulatory/site documents — aimed at being genuinely
easier to use than the incumbents (Medidata, Veeva, Florence), which is both
the product's differentiator and, usefully, keeps you building your own UX
rather than anyone else's. Modeled loosely on OneStudyTeam and Curebase
Sitebase's category, with Phoenix CTMS as an open-source architectural
reference — not on SClinico, which stays out of scope entirely for a
commercial multi-tenant product.

---

## 2. Users & Roles

Now scoped **per organization** (tenant), since this is multi-tenant:

| Role | Access |
|---|---|
| **Study Coordinator (CRC)** | Full read/write on assigned studies within their org |
| **Principal Investigator (PI)** | Read/write on their studies; approves/signs documents |
| **Org Admin** | User management, study setup within their org — this is your paying customer's admin |
| **Platform Admin** (you) | Cross-org visibility for support/ops only — never casual access to customer data |
| *(Future)* Sponsor/Monitor | Read-only, scoped, de-identified where required |

RBAC enforced via Postgres row-level security keyed on `organization_id` —
this is the one piece of the multi-tenant architecture that's genuinely hard
to retrofit later, so get it right in Phase 0.

---

## 3. Core Data Model

- **organizations** — the tenant: name, plan, region/hosting preference, created_at
- **studies** — organization_id, protocol ID, title, phase, status, sponsor
- **sites** — organization_id, if a customer runs multiple sites
- **subjects** — pseudonymized subject ID, study_id, status (funnel below), I/E criteria snapshot, **is_test_data flag**
- **visits** — subject_id, study_id, visit_type, target_date, window, actual_date, status
- **visit_schedule_templates** — per-study protocol visit definitions
- **documents** — study_id/subject_id, type, version, file, expiry_date, status
- **users** — organization_id, role, assigned studies
- **audit_log** — table, record_id, action, actor_id, timestamp, before/after diff — append-only

Every tenant-scoped table carries `organization_id`; every subject/document
table writes to `audit_log`. Build both in Phase 0.

**`is_test_data` flag on subjects**: lets you clearly separate synthetic
pilot-testing records from anything real later, and gives you an easy way to
purge all test data before a real customer's first login.

---

## 4. Module 1 — Recruitment Tracker

- Funnel: `identified → pre-screened → screened → consented → enrolled → screen-failed / withdrawn`
- I/E criteria checklist per study, filterable subject list
- Referral source field
- Dashboard: subjects by stage, by study, conversion rate

## 5. Module 2 — Visit Scheduling (CTMS core)

- Protocol visit schedule per study (name, target offset, window)
- Auto-calculate target date + window per subject on enrollment
- Coordinator calendar view
- Visit status: scheduled / completed / missed / rescheduled
- Simple N-days-before reminder (email)

## 6. Module 3 — eISF / Regulatory Documents

- Per-study repository: protocol, IB, ICF versions, delegation log, training records
- Version control, expiry tracking with dashboard alerts
- "Signed by / date" + audit-log entry stands in for full e-signature —
  **real 21 CFR Part 11 e-signature is a Phase 5 item**, required before any
  US commercial customer can use this for FDA-regulated trials

---

## 7. Non-Functional Requirements (prototype phase)

- **Hosting:** pick whatever's fastest to stand up right now — region
  flexibility matters far less while every record in the system is synthetic.
  Revisit properly in Phase 5 once you know which market you're onboarding
  a real customer in first (US → needs a BAA-capable host; EU → GDPR-region
  hosting; each Asian market has its own data-residency rules to check).
- **No real subject/patient data until Phase 5 is complete.** This is the
  single most important guardrail for moving fast right now: synthetic data
  sidesteps HIPAA/GDPR/local-equivalent obligations that a real PHI record
  would immediately trigger. Seed the database with realistic fake subjects
  for testing.
- **Audit trail:** immutable, append-only — build this now even though
  enforcement/compliance review is a Phase 5 concern, because retrofitting
  audit logging onto existing tables is genuinely painful.
- **RBAC:** Postgres row-level security keyed on `organization_id`.
- **Auth:** email/password + MFA is enough for the prototype.

---

## 8. Suggested Tech Stack

| Layer | Suggestion | Why |
|---|---|---|
| Frontend | Next.js + TypeScript + Tailwind | Fast iteration with Claude Code |
| Backend | Next.js API routes | Simplicity while validating the product |
| Database | PostgreSQL | RLS + audit triggers, multi-tenant-friendly |
| ORM | Prisma | Schema-as-code, easy migrations as the model evolves |
| Auth | Auth.js (NextAuth) or Clerk | Clerk if you want org/tenant management handled for you out of the box — worth considering now that this is multi-tenant |
| Hosting (prototype) | Vercel + a managed Postgres (Neon/Supabase) — pick whichever region is closest to you for now | Revisit region/compliance posture in Phase 5 |

---

## 9. Build Sequence — optimized for "get something testable fast"

1. **Phase 0 — Foundation:** repo scaffold, multi-tenant schema (organizations + `organization_id` everywhere), auth, RBAC via RLS, audit log trigger. Seed script for synthetic demo data.
2. **Phase 1 — Recruitment:** subjects, funnel stages, I/E checklist, subject list UI — using seeded synthetic subjects.
3. **Phase 2 — Visits:** protocol visit schedule builder, per-subject visit generation, calendar view.
4. **Phase 3 — Documents:** upload/versioning, expiry tracking, document list.
5. **Phase 3.5 — Get it in front of real coordinators.** This is the actual goal of the whole sequence above: a handful of test users (yours, or friendly pilot contacts) clicking through real workflows with synthetic data, telling you what's confusing. Don't skip straight to Phase 4 without this.
6. **Phase 4 — Dashboards:** recruitment funnel, upcoming visits, expiring documents, informed by what Phase 3.5 feedback actually asked for.
7. **Phase 5 — Commercial hardening (gate before any real customer/data):** finalize hosting region(s) per target market, HIPAA BAA if onboarding US customers, full 21 CFR Part 11 e-signature, SOC 2 roadmap, trademark clearance finalized, patent attorney FTO review, GDPR/local data-residency review per target country, purge all `is_test_data` records before first real customer.

---

## 10. Open Decisions

- Working product name — run the trademark self-check before it's in the repo/domain.
- Which 1–2 countries in Asia to actually target first (regulatory landscape varies enormously — Japan, Singapore, and India, for instance, have almost nothing in common on data residency or trial regulation).
- Clerk (or similar) vs. hand-rolled multi-tenant auth — worth deciding before Phase 0, since it changes the schema.
- Who tests the Phase 3.5 prototype — your own coordinators, or outside pilot contacts?

---

## 11. How to Use This With Claude Code

Save this as `CLAUDE.md` (or keep as `PROJECT_SPEC.md` and reference it) in
your project folder, then open with:

> "Read PROJECT_SPEC.md. Let's start Phase 0: scaffold a Next.js + TypeScript +
> Prisma + PostgreSQL project with the organizations/studies/sites/subjects/
> visits/documents/users/audit_log schema from section 3, with organization_id
> on every tenant-scoped table. Set up row-level security keyed on
> organization_id, an audit-log trigger, and a seed script that creates one
> demo organization with realistic synthetic subjects and studies."

Go phase by phase, and don't skip Phase 3.5 — that's the actual point of
building this fast rather than fully-formed.
