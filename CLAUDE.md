# Working notes for Claude Code

Read [PROJECT_SPEC.md](./PROJECT_SPEC.md) first — it's the product spec and
phased build sequence. [README.md](./README.md) has setup steps and current
build status. This file is just working notes for whoever (human or Claude)
picks this repo up next.

## Load-bearing decisions — don't casually change these

- **`prisma/seed.ts` now wipes all data first** (`TRUNCATE ... CASCADE`
  across every table, run as the owner role via DIRECT_URL) before
  reseeding. It was purely additive before — adding an org, subjects, etc.
  on top of whatever existed. It is NOT additive anymore: running it against
  a database with real work in it destroys that work. It recreates the
  `site@riverside-research.dev` account with a fixed password on every run
  specifically so a live testing session's login keeps working across a
  reseed; other seeded accounts share the generic demo password.
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
  **This does not work on Vercel** — serverless functions there have a
  read-only filesystem outside `/tmp`, and even `/tmp` doesn't persist or
  share across invocations, so an uploaded file is gone (or the write fails
  outright) by the time anything tries to read it back. Swap `storage.ts` for
  a real object-storage client (S3/R2/Vercel Blob) before relying on document
  upload in the deployed environment — this is the biggest gap between "runs
  locally" and "actually usable by pilot testers on the deployed URL."
- **`package.json` needs `"postinstall": "prisma generate"`.** Without it,
  Vercel's build installs dependencies but never generates the Prisma
  Client, and every page that touches the database 500s in production with
  no useful error message (found by deploying and hitting a bare "Internal
  Server Error" on the homepage). Don't remove this script.
- **Visit reminders send real email via Resend** (`src/lib/email.ts`) when
  `RESEND_API_KEY` is set; otherwise `sendEmail` falls back to logging to the
  console. No Resend account exists in this environment, so the Resend path
  itself is unverified — only the console fallback has actually been
  exercised. Recipients are everyone in `study_assignments` for that visit's
  study, not the subject (there's no subject email/contact info in the
  schema — subjects are pseudonymized).
- **`audit_log.organizationId`/`actorId` have NO foreign keys**, deliberately.
  They did originally; deleting an `organizations` row failed because the
  trigger's own insert (logging the delete) violated the FK to the row being
  deleted in the same statement, and the same shape of bug would block
  deleting any user who'd ever performed a logged action. An audit trail has
  to outlive the rows it describes. Don't add these FKs back.
- **The proxy/middleware matcher excludes all of `/api/*`**, not just
  `/api/auth` — found by testing: the `authorized` callback's redirect-to-
  `/login` turns an unauthenticated `fetch()` into a 302-to-HTML instead of
  JSON, breaking `res.json()` on the client. Each API route enforces its own
  auth via `requireTenantContext()` instead. Don't narrow the matcher back to
  just `api/auth` without re-solving this.
- **Adding a new tenant-scoped table is a 3-step, not 1-step, change**:
  (1) add the model in `schema.prisma` and `prisma migrate dev` it as usual,
  (2) write a follow-up hand migration enabling RLS + the audit trigger on it
  (copy the shape from `prisma/migrations/20260917145344_feedback_rls_and_audit`
  — same policies, same `audit_trigger_fn()`), (3) add the table to both loop
  arrays in `prisma/rls_and_audit.sql` so a *fresh* setup applies it too, not
  just this already-migrated database. `ALTER DEFAULT PRIVILEGES` from the
  original migration already covers `app_runtime`'s SELECT/INSERT/UPDATE/
  DELETE grant on new tables automatically — confirmed when adding
  `feedback_submissions` — but the RLS policies and trigger are NOT automatic
  and silently leave a new table with no tenant isolation at all if skipped.
- **Never hand-edit an already-applied migration.sql's content** (I did once,
  scrubbing a dev password before committing) — `prisma migrate dev` checksums
  applied migrations and refuses to proceed on a mismatch, offering
  `migrate reset` (drops all data). If you must, the recovery is to reconcile
  the stored checksum directly: `UPDATE _prisma_migrations SET checksum = ...
  WHERE migration_name = '...'` with the SHA-256 of the new file content
  (`Get-FileHash -Algorithm SHA256`), never `migrate reset` on a database with
  real work in it.
- **Document status is computed, not stored** (`src/lib/document-status.ts`'s
  `getDocumentDisplayStatus`) — Pending/Active/Expired derive live from
  `signedAt`/`expiryDate`; the `status` column on `Document` only still holds
  meaning for `SUPERSEDED` (set by the upload action when a newer version
  replaces one). Never read `doc.status` directly for a user-facing badge —
  always go through `getDocumentDisplayStatus`, or a fixed expiry date and an
  unsigned document will keep showing whatever stale status it was created
  with.
- **Documents can be scoped to a study, a subject, AND/OR a specific visit**
  (`Document.visitId`, nullable, added after the initial schema). The
  supersede-on-reupload match key in `documents/actions.ts` includes
  `visitId` — two documents with the same type/title but different visits
  are NOT the same document version.
- **Two ways of pushing a schema change to production**: `prisma migrate dev`
  locally against `localhost:5432/sitepilot`, then `prisma migrate deploy`
  against Neon with `DATABASE_URL`/`DIRECT_URL` temporarily overridden to the
  Neon owner connection (see git history around the `add_document_visit_link`
  migration for the exact commands). Vercel does NOT run migrations itself on
  deploy — a schema change that's only applied locally will 500 in production
  the moment a query touches the new column/table.
- **Windows PowerShell + literal `$` in SQL (bcrypt hashes, anything
  containing `$`)**: use a single-quoted here-string (`@'...'@`), never a
  double-quoted one (`@"..."@`) — double-quoted here-strings interpolate `$`
  as PowerShell variable references and will silently mangle a bcrypt hash
  (found by creating a user whose password then didn't work — the stored
  hash had been corrupted to a fragment of itself).
- **Per-visit-type checklists, two tables, loosely linked.**
  `ChecklistTemplateItem` belongs to a `VisitScheduleTemplate` (the
  definition — every "Baseline" visit across subjects shares it).
  `VisitChecklistResult` belongs to one specific `Visit` and is created
  lazily the first time `getVisitChecklist()` runs for that visit — there's
  no backfill step when you add a new checklist item to a template; existing
  visits just pick it up next time their checklist is viewed.
  `VisitChecklistResult.templateItemId` is nullable (`ON DELETE SET NULL`,
  not the default RESTRICT) and `label`/`detail`/`sortOrder` are
  denormalized onto the result row at creation time, not joined from the
  template item, for two reasons: (1) a coordinator can add a procedure to
  just one visit (`addVisitChecklistItem`, `templateItemId: null`) since
  visits aren't static — an unplanned extra step, or one that doesn't apply
  this time — without touching the shared template every other subject's
  visit of that type uses; (2) deleting a `ChecklistTemplateItem`
  (`deleteChecklistTemplateItem`) no longer needs to force-delete every
  visit's already-recorded row for it — the FK just detaches it, so that
  visit's checked/unchecked history and label survive as a plain
  visit-only row. Removing an item from one visit (`removeVisitChecklistItem`)
  is a soft-delete (`removed: true`), not `.delete()` — for a
  template-derived row, hard-deleting it would make `getVisitChecklist`'s
  lazy-creation pass see it as "missing" and silently recreate it the next
  time that visit's checklist is viewed.
- **Checklist docx header fields are explicit, not derived** —
  `Study.piName`, `Study.protocolAmendment`, `Study.protocolDate`, and
  `Site.siteNumber` (edited via the "Document header details" form on
  `/dashboard/studies/[id]/templates`). This used to be resolved from
  `study_assignments`' first PI-role user and "today's date" — deliberately
  replaced, since the printed PI name and protocol date are fixed facts
  about the protocol document, not whoever's logged in or when a copy
  happens to be downloaded. `getVisitChecklistHeader()` still falls back to
  the org's first `Site` row (a study could have more than one; revisit if
  that ever needs picking).
- **Checklist task library entries don't link back to templates.** Picking
  one from the "Add a checklist item" dropdown just copies its label/detail
  into a new `ChecklistTemplateItem` row — editing or deleting a
  `ChecklistTaskLibrary` entry later never touches templates that already
  used it. `addChecklistTemplateItem` upserts into the library on every add
  (by `[organizationId, label]`), so the library only ever grows from real
  usage; nothing prunes it.
- **Kits are study/visit-type inventory, not per-subject.** `Kit` has no
  link to an individual `Subject` or `Visit` — `visitScheduleTemplateId` is
  which visit TYPE a batch is earmarked for (e.g. "Baseline kits, Lot B"),
  not which subject received one. If a per-subject dispensing log is ever
  wanted, that is a different model, not a change to this one.
- **Study and Team management (`/dashboard/studies` add/edit,
  `/dashboard/team`) are gated to `ORG_ADMIN`/platform admin**, checked both
  in the page (hides the UI, and `/dashboard/team` refuses to even query
  member data for anyone else) and again in every server action in
  `src/app/dashboard/studies/actions.ts` and
  `src/app/dashboard/team/actions.ts` — the action-level check is the real
  gate, since a server action is a callable endpoint regardless of what the
  UI hides. Deleting a user (`deleteTeamMember`) can't just `user.delete` —
  `StudyAssignment.userId`, `Document.signedById`, and
  `FeedbackSubmission.submittedById` all reference `User` with no cascade.
  The action clears the user's own `StudyAssignment` rows first (safe, just
  a link) but blocks the whole delete with a friendly error if the user has
  signed documents or feedback, rather than letting a raw FK violation
  reach the client. Self-deletion is blocked outright. `PLATFORM_ADMIN` is
  deliberately not an assignable role from this page — it's cross-org, not
  something one org's admin should be able to grant.

## Before calling a change done

Run, in order: `npm run lint`, `npx tsc --noEmit`, `npm run build`. All three
are clean as of this writing — keep them that way.

## Environment

PostgreSQL 17 is installed locally (via winget) and the app has been run and
clicked through end-to-end against it — login, MFA, RLS isolation (verified
directly with raw SQL: a second org's rows are invisible to `app_runtime`
scoped to org A, and a cross-tenant insert is rejected), the audit trigger,
enrollment → auto visit generation, visit status actions, document
upload/versioning/download, and the sign-permission check. No Docker.
`.env` (gitignored) has the working local connection strings; `.env.example`
documents the shape for setting this up elsewhere.

**Also deployed and live**: https://sitewell-ct.vercel.app, GitHub repo
`martins-gil/Sitewell`, Neon Postgres for production. Two databases exist —
local (`sitepilot`) and Neon (`neondb`) — with independent seeded data
(different random subject counts; that's expected, not a bug). Document
upload does NOT work on the deployed site (see the local-disk-storage note
above) even though it works locally — remember which environment you're
testing against.
