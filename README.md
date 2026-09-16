# Sitepilot (working name)

Clinical trial site platform — recruitment tracking, visit scheduling, and
eISF/regulatory documents, multi-tenant from the data model up. See
[PROJECT_SPEC.md](./PROJECT_SPEC.md) for the full product spec and build
sequence; this file covers local setup and current status.

**"Sitepilot" is a placeholder name** — it has not been trademark-checked
(see PROJECT_SPEC.md section 0 / section 10). Rename before any real
branding, domain, or commercial use.

## Status: Phases 0–2 complete, Phase 3 mostly done

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
  manually-triggered N-days-before reminder pass (`/api/reminders/run` —
  "sending" currently just logs to the server console; no email provider is
  wired up yet, see `src/lib/reminders.ts`). Still a flat list, not a real
  calendar view.
- 🟡 Module 3 (Documents): upload with automatic version supersede, local-disk
  storage (`src/lib/storage.ts` — prototype only, not Phase-5-ready), expiry
  highlighting, a lightweight "sign" action. Not yet done: delegation
  log/training-record-specific workflows beyond generic upload.
- ⬜ Phase 3.5 (pilot testing), Phase 4 (dashboards), Phase 5 (commercial
  hardening) — not started, by design (see PROJECT_SPEC.md)

## Environment note

This was built on a machine with **no Git, Docker, or local Postgres
installed** — only Node.js. That shaped a few decisions:

- No local Postgres container. You need a cloud dev database (Neon or
  Supabase both have a free tier and take a couple of minutes to set up —
  see PROJECT_SPEC.md section 8) before you can actually run this.
- The RLS + audit-trigger SQL (`prisma/rls_and_audit.sql`) couldn't be
  applied or tested against a live database yet — it's written and
  internally consistent, but treat it as unverified until you've run it once.
- The repo has not been initialized as a git repository yet — do that
  yourself (`git init`) once Git is available, or ask your assistant to.

## First-time setup

1. **Get a Postgres database.** Easiest: [neon.tech](https://neon.tech) or
   [supabase.com](https://supabase.com), free tier, same region as you.
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
