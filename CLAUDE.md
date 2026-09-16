# Working notes for Claude Code

Read [PROJECT_SPEC.md](./PROJECT_SPEC.md) first — it's the product spec and
phased build sequence. [README.md](./README.md) has setup steps and current
build status. This file is just working notes for whoever (human or Claude)
picks this repo up next.

## Load-bearing decisions — don't casually change these

- **Two Postgres roles, two Prisma clients.** `src/lib/prisma.ts`
  (DATABASE_URL, `app_runtime`, RLS-bound) is used for every ordinary
  business query via `withTenantContext`/`requireTenantContext` in
  `src/lib/db-context.ts`. `src/lib/prisma-auth.ts` (DIRECT_URL, owner role,
  bypasses RLS) exists ONLY for the login bootstrap problem — looking a user
  up by email before we know their `organization_id`. Never use
  `prisma-auth.ts` for anything else; never let ordinary queries skip
  `withTenantContext`.
- **`prisma/rls_and_audit.sql` is hand-maintained**, not a normal
  `prisma migrate dev`-generated migration — Prisma's schema language can't
  express RLS policies or triggers. If you change which tables are
  tenant-scoped, update the table list in that file too.
- **`auth.config.ts` vs `auth.ts` split** exists because Prisma's Node
  bindings can't run in the Edge middleware runtime. `src/proxy.ts` (Next 16's
  middleware convention) imports only `auth.config.ts`. Don't import
  `src/auth.ts` from `proxy.ts` — that will pull Prisma into the edge bundle.
- **`is_test_data`** on subjects: every seeded/synthetic subject sets this
  `true`. Per PROJECT_SPEC.md, no real subject/patient data is allowed in
  this system before Phase 5 — don't build a path that creates subjects with
  `is_test_data: false`.
- **Document storage is local disk** (`src/lib/storage.ts`, files under the
  gitignored `uploads/`), because no object storage (S3/R2/Vercel Blob) is
  configured. `/api/documents/[id]/file` re-checks org access via
  `withTenantContext` before reading the file — don't add a route that reads
  from `uploads/` directly by path without going through that check first.
  Swap `storage.ts` for a real object-storage client in Phase 5.
- **Visit reminders don't send real email** yet (`src/lib/reminders.ts` logs
  to the console) — no email provider is configured. The due-visit query and
  `reminderSentAt` bookkeeping are real; only `sendReminderEmail`'s body is a
  stand-in.

## Before calling a change done

Run, in order: `npm run lint`, `npx tsc --noEmit`, `npm run build`. All three
were clean as of Phase 0 — keep them that way.

## Environment

Built on a machine with no Git, Docker, or local Postgres — Node.js only.
Migrations have not been run against a live database. If you're picking this
up somewhere that has Postgres/Docker, treat `prisma/rls_and_audit.sql` as
unverified until you've actually run it once and confirmed cross-org
isolation with a manual test (create two orgs, confirm org A's session can't
see org B's rows even as a raw SQL check against `app_runtime`).
