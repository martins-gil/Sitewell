# Sitepilot (working name)

Clinical trial site platform — recruitment tracking, visit scheduling, and
eISF/regulatory documents, multi-tenant from the data model up. See
[PROJECT_SPEC.md](./PROJECT_SPEC.md) for the full product spec and build
sequence; this file covers local setup and current status.

**"Sitepilot" is a placeholder name** — it has not been trademark-checked
(see PROJECT_SPEC.md section 0 / section 10). Rename before any real
branding, domain, or commercial use.

## Status: Phases 0–2 complete, Phase 3 mostly done — running and verified locally

PostgreSQL 17 is now installed locally and everything below has actually been
run and clicked through, not just lint/typecheck/build: login, MFA
setup/verify/disable, subject enrollment → auto visit generation, visit
complete/miss/reschedule actions, the reminder pass, document upload with
version supersede, download, and the sign-permission check. Two real bugs
turned up during that testing and are fixed (see git log): `audit_log`'s
foreign keys to `organizations`/`users` made the audit trigger break tenant
deletion (removed — an audit trail needs to outlive what it describes), and
the proxy/middleware matcher was redirecting unauthenticated API calls
(`/api/login/precheck`) to the login *page* instead of failing as JSON,
breaking the client fetch. RLS cross-tenant isolation was verified directly
against Postgres (a second org's rows are invisible to `app_runtime` scoped
to org A, and a cross-tenant insert is rejected).

- ✅ Next.js 16 + TypeScript + Tailwind, App Router
- ✅ Prisma schema for the full data model (organizations, studies, sites,
  subjects, visits, visit schedule templates, documents, users, audit_log)
- ✅ Row-level security (`prisma/rls_and_audit.sql`) keyed on `organization_id`,
  enforced via a dedicated `app_runtime` Postgres role — see that file for how
  to apply it
- ✅ Append-only audit log via a `SECURITY DEFINER` Postgres trigger (app code
  has no write grant on `audit_log` at all — only the trigger can insert)
- ✅ Auth: email/password (Auth.js/NextAuth v5, credentials provider,
  bcrypt) + TOTP-based MFA (`otplib` + QR provisioning), JWT sessions
- ✅ RBAC roles modeled (CRC, PI, Org Admin, Platform Admin) — enforcement is
  via RLS + the `organizationId`/`role`/`isPlatformAdmin` on the session, plus
  a couple of explicit role checks (signing a document); per-route/per-action
  authorization is otherwise still coarse and should be hardened before
  Phase 5
- ✅ Seed script (`prisma/seed.ts`) generating one synthetic demo
  organization, 5 users, 2 studies, visit schedule templates, ~20-24
  subjects per study across the recruitment funnel, generated visits, and
  sample eISF documents — all flagged `is_test_data: true`
- ✅ Module 1 (Recruitment): subject list with study/stage filters, subject
  detail page, I/E criteria checklist, referral source
- ✅ Module 2 (Visits): protocol visit-schedule builder per study
  (`/dashboard/studies/[id]/templates`), auto-generation of a subject's
  visits on enrollment, visit status actions (complete/miss/reschedule), a
  coordinator calendar view (month grid, click a visit to jump to its
  subject) with a toggle back to the flat list, and a manually-triggered
  N-days-before reminder pass (`/api/reminders/run`) that emails everyone
  assigned to the study via Resend (`src/lib/email.ts`) — falls back to
  logging to the console when `RESEND_API_KEY` isn't set (true in this
  environment; only the console path has actually been exercised — see
  CLAUDE.md).
- 🟡 Module 3 (Documents): upload with automatic version supersede, local-disk
  storage (`src/lib/storage.ts` — prototype only, not Phase-5-ready), expiry
  highlighting, a lightweight "sign" action. Not yet done: delegation
  log/training-record-specific workflows beyond generic upload.
- 🟡 Phase 3.5 (pilot testing) started: an in-app `/dashboard/feedback` page
  (area tested, ease-of-use rating, what was confusing/broken, suggestions)
  that any logged-in user can submit and everyone in the org can read — not
  in PROJECT_SPEC.md's data model, added because this phase needs somewhere
  for feedback to land besides a scattered chat thread. Deliberately built
  into the app itself rather than as a separate form, since real pilot
  coordinators won't have accounts in any Claude.ai organization, which a
  Claude Artifact's shared database would have required. Still open: how
  testers actually reach the app (local machine vs. deployed) — undecided.
- ⬜ Phase 4 (dashboards), Phase 5 (commercial hardening) — not started, by
  design (see PROJECT_SPEC.md)

## Environment note

This machine originally had no Git, Docker, or local Postgres — only
Node.js. Git and PostgreSQL 17 have since been installed (via winget) so the
app could actually be run and tested rather than just typechecked. There's
still no Docker. Local dev now runs against that local PostgreSQL 17
instance (database `sitepilot`); see `.env` for the connection strings (not
committed — `.env.example` documents the shape). A real deployment should
still move to a managed host per PROJECT_SPEC.md section 8 — Phase 5, not
before.

## First-time setup

This repo already has a working local `.env` (PostgreSQL 17 installed
locally, migrations applied, seeded). These steps are for setting it up
somewhere else — a teammate's machine, a cloud dev database, CI, etc.

1. **Get a Postgres database.** Locally: install PostgreSQL and create a
   database. Or in the cloud: [neon.tech](https://neon.tech) or
   [supabase.com](https://supabase.com), free tier.
2. **Copy `.env.example` to `.env`** and fill in `DATABASE_URL` /
   `DIRECT_URL` (see the comments in that file — they need to be two
   different Postgres *roles*, not just the same URL twice) and generate an
   `AUTH_SECRET` with `npx auth secret`.
3. **Create the tables:**
   ```bash
   npx prisma migrate dev --name init
   ```
4. **Apply row-level security + the audit trigger** (can't be expressed in
   Prisma's schema language, so it's a hand-written migration):
   ```bash
   npx prisma migrate dev --create-only --name rls_and_audit
   ```
   Then paste the contents of `prisma/rls_and_audit.sql` into the generated
   `prisma/migrations/<timestamp>_rls_and_audit/migration.sql`, replace
   `CHANGE_ME_STRONG_PASSWORD` with a real password, and run:
   ```bash
   npx prisma migrate dev
   ```
   Update `DATABASE_URL` in `.env` to use the new `app_runtime` role/password
   at this point — the app must NOT connect as the table owner (owners
   bypass RLS).
5. **Seed synthetic demo data:**
   ```bash
   npm run db:seed
   ```
   Prints login credentials for the seeded users (all share one demo
   password) at the end.
6. **Run it:**
   ```bash
   npm run dev
   ```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |
| `npm run db:seed` | Re-seed synthetic demo data |
| `npx prisma studio` | Browse the database |
