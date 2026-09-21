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
  bypasses RLS) exists ONLY for the "starts from an email address, before we
  know the organization" problem: the sign-in lookup and its lockout
  bookkeeping, and the forgot-password flow (`src/lib/password-reset.ts`).
  Never use `prisma-auth.ts` for anything else; never let ordinary queries skip
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
- **Document storage has two backends** (`src/lib/storage.ts`): Cloudflare R2
  (any S3-compatible bucket) when `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`
  and `R2_SECRET_ACCESS_KEY` are ALL set, else local disk (the gitignored
  `uploads/`, for development). Vercel functions have no persistent disk, so the
  deployed site needs the R2 settings — without them an upload fails with the
  "couldn't be saved" message and the document can still be logged with no file.
  `uploadDocument`/`attachDocumentFile` RETURN `{ok:false, message}` for a file
  problem (a thrown error would be masked in production); the message carries
  only an error CODE plus a hint (`NoSuchBucket`, `InvalidAccessKeyId`,
  `SignatureDoesNotMatch`, `AccessDenied`…) so whoever sets the site up can fix
  a wrong setting, and the full error goes to the server log. The S3 client is
  built with `requestChecksumCalculation`/`responseChecksumValidation` =
  `WHEN_REQUIRED` — recent AWS SDKs add checksum trailers R2 doesn't take.
  The bucket must stay PRIVATE and have no public URL: every download goes
  through `/api/documents/[id]/file`, which re-checks org access via
  `withTenantContext` before `readStoredFile` is called — don't add a route or
  a presigned URL that reaches a file without going through that check. Keys are
  `<organizationId>/<uuid>-<original name>` (the download route derives the
  file name, extension included, from that). The R2 bucket for this project was
  created in the EU jurisdiction (its endpoint has `.eu.` in it); that can't be
  changed after creation. Uploads are capped at 4 MB (`next.config.ts`),
  because Vercel refuses request bodies over ~4.5 MB; larger files would need
  uploads straight to the bucket (presigned URLs).
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
- **Document status is SET BY PEOPLE and stored** (this used to be computed
  from `signedAt`/`expiryDate` — it isn't anymore; migration
  `20260921090000_document_status_is_set_by_people` converted existing rows so
  nothing changed on screen). The user picks it when adding a document and can
  change it any time (`setDocumentStatus`, `DocumentStatusControl`). Four
  states: Pending (stored as `DRAFT`), Active, Expired, Superseded
  (`toStoredStatus`/`getDocumentDisplayStatus` in `src/lib/document-status.ts`).
  Still never read `doc.status` directly for a badge — go through
  `getDocumentDisplayStatus`, because one rule is still automatic: an ACTIVE
  document whose expiry date has passed is shown as Expired (so
  `assertCanBeActive` refuses setting Active on one — fix the expiry first).
  Versioning is tied to becoming ACTIVE, not to being added: adding an Active
  document, signing a Pending one (which activates it), or setting one to
  Active all run `supersedeOlderVersions` (same study/subject/visit/type/title,
  older Active → Superseded). A document added as Pending does NOT retire the
  version currently in force. Anyone signed in can change a status; the audit
  trigger records who and when.
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
- **Where each value on the checklist .docx comes from** (all in
  `getVisitChecklistHeader()`; layout in `src/lib/checklist-docx.ts`, which
  follows the site's "V3" template — checked by rendering it in Word and
  comparing against the template, not just by inspecting the XML):
  PI name = `Study.piName`; Site Nº = the study's first `Site.siteNumber`;
  "Protocol Nº" = `Study.protocolId`; protocol version and release date =
  the study's protocol DOCUMENT (`Document.version` / `Document.releaseDate`,
  chosen by `pickProtocolDocument`: newest ACTIVE, else newest PENDING —
  never expired/superseded); the "(V3)" after the heading and the footnote
  under the table = `VisitScheduleTemplate.checklistVersion` /
  `checklistFootnote` (per visit type). Nothing is derived from who's logged
  in or from "today". The old `Study.protocolAmendment`/`protocolDate`
  columns are DEPRECATED and unused — kept only because the migration that
  moved their values onto the protocol document was made additive so the
  previous deploy kept working; drop them in a follow-up migration. The
  printed form has no subject line (the subject code is in the filename).
  `updateStudyPiAndSite` (study page) and `updateVisitDocumentDetails`
  (visit page) both write through `setStudyPiAndSite`.
- **Checklist task library entries don't link back to templates.** Picking
  one from the "Add a checklist item" dropdown just copies its label/detail
  into a new `ChecklistTemplateItem` row — editing or deleting a
  `ChecklistTaskLibrary` entry later never touches templates that already
  used it. `addChecklistTemplateItem` upserts into the library on every add
  (by `[organizationId, label]`), so the library only ever grows from real
  usage; nothing prunes it.
- **Visits can be added by hand, not only auto-generated on enrollment.**
  `addVisit` / `generateProtocolSchedule` / `deleteVisit` in
  `dashboard/visits/actions.ts`; eligible patient statuses live in
  `src/lib/visit-scheduling.ts`. Two behaviors to keep in mind:
  `generateVisitsForSubject` (the on-Enrolled auto-generation) still bails
  out if the patient has ANY visit, so a hand-built program isn't padded
  with protocol visits nobody chose — `generateMissingVisitsForSubject` is
  the "fill in the rest" path and skips visit types already present. And
  hand-entered dates are stored at noon UTC (`parseDateOnly`), not midnight,
  so a date-only value doesn't slip to the previous day west of UTC. A
  visit added from a protocol visit type keeps `templateId` (that's what
  links it to that type's checklist); a custom-named one has none and starts
  with an empty checklist (per-visit procedures can still be added).
- **Documents don't need a file, and copied eligibility criteria aren't
  "met".** `Document.fileUrl` is nullable (null = logged, nothing attached;
  every reader checks for it, including `/api/documents/[id]/file`, which
  404s). `saveOptionalFile` turns a storage failure (the read-only Vercel
  filesystem) into a message telling the user to leave the file empty, rather
  than a raw error. On the patient side, `Subject.ieCriteriaSnapshot` entries
  are `{criterion, met: true | false | null}`; `null` = not assessed, which is
  what `addSubject` writes when it clones a source patient's criteria — it
  copies the TEXT only, never the source's answers, so a new patient is never
  recorded as meeting a criterion nobody assessed. `addSubject` also takes the
  visit list the form sent (`visitPlan`, zod-validated): rows the coordinator
  edited/left out, with `templateId` checked against the study. The visit NAME
  is the form's (a repeated visit keeps "Week 8" while sharing Week 4's
  `templateId`); the template's name is only the fallback for a blank one.
  In the form, entering the **Baseline / Day 0 date** places every visit that
  IS the protocol's own (its name equals its visit type's) on Baseline + the
  visit type's `targetDayOffset` with the protocol window — the strict plan —
  while a repeat or custom visit keeps its gap from the copied patient's
  Baseline. A source with no Baseline visit falls back to "start the schedule
  on" (shift everything by the same number of days).
- **The document details are shown and editable on each visit's page**
  (`visit-doc-header.tsx`) but they're not visit data: saving there
  (`updateVisitDocumentDetails`) writes each field to its real home — study,
  protocol document, visit-type checklist — so it changes every visit's
  document. Fields that don't apply are omitted from the form (no protocol
  document yet; a custom visit with no checklist) and skipped server-side by
  `formData.has`, not blanked. Visits themselves are editable
  (`updateVisit`): a visit made from a protocol visit type keeps its name
  UNLESS `canRenameVisit` (queries.ts) says otherwise — the link to the
  checklist is `templateId`, not the name, so a visit that shares its
  `templateId` with another of the same patient's visits (a repeat) or already
  has a different name may be renamed; entering an actual date forces
  Completed; a moved target date clears `reminderSentAt`.
- **Repeating a visit** (`repeatVisit`, `visits/actions.ts`): a copy keeps the
  source's `templateId` — that is what keeps the checklist column, version,
  footnote and nursing sheet identical — and only the name/date/windows
  change. It may go to another patient of the SAME study (checked server-side,
  and the patient must `canScheduleVisits`). The source's checklist rows are
  copied (label/detail/order/removed) but unticked, with no time; notes, kits
  and documents are not. Returns a result object, never throws.
- **Procedure date/time, visit notes and nursing sheets.**
  `VisitScheduleTemplate.checklistColumn` (`VERIFIED` | `DATETIME`) is a
  per-visit-TYPE choice of the checklist's last column — it lives on the
  template, so custom visits (no template) are always `VERIFIED`.
  `VisitChecklistResult.performedAt` is a "floating" wall-clock time stored as
  if UTC (`parseDateTimeInput` appends `:00Z`; `toDateTimeInput`/
  `formatDateTime` read it back with UTC slices) — never format it with
  local-time APIs or it will shift by the server's offset. Setting a time
  ticks the procedure; un-ticking clears it. `Visit.notes` is free text
  printed as "Notas:" on both documents, along with the visit's linked kits.
  The nursing sheet is a JSON *definition* (`VisitScheduleTemplate.nursingSheet`,
  validated by `nursingSheetSchema` in `src/lib/nursing-sheet.ts` on every
  save AND every read — `parseNursingSheet` returns null for a stored value
  that no longer validates) rendered as a blank form; the nurse's readings
  are handwritten and NOT stored. A visit type with no stored sheet (and every
  custom visit) falls back to `defaultNursingSheet()` in
  `getVisitChecklistHeader`, so the download always exists — `nursingSheet` on
  the header is never null; `nursingSheetIsCustom` says which it is. Clearing
  a custom sheet writes `Prisma.DbNull`, not a bare `null`. `prisma/seed.ts` imports the presets from `src/lib`
  by relative path (no `@/` alias there).
- **Translations are gettext-style: the English text IS the key.** Write
  `t("Save")` / `t("{0} kit|{0} kits", [n])` (positional `{0}` placeholders;
  `a|b` = singular|plural by the first argument, via `Intl.PluralRules`) —
  server components `const t = await getT()` (`src/lib/i18n/server.ts`), client
  components `const t = useT()`. Every text needs a row in
  `src/lib/i18n/catalog.json` (`[fr, de, it, es, pt]`, European Portuguese);
  a missing row silently falls back to English on screen, so run
  `npm run i18n:check` (it also verifies placeholders and plural bars match).
  Texts that reach `t()` dynamically — `t(humanizeEnum(status))`, option
  lists — can't be seen by the check, so list them in
  `src/lib/i18n/extra-keys.ts` too. `humanizeEnum` output IS the key
  ("PRE_SCREENED" -> "Pre Screened"; only IB/ICF/CRC/PI stay upper-case).
  Never name a local variable `t` in a component (it shadows the translator).
  Dates: `formatDate(date, t.locale)` — pass the locale, or you get English.
  `Badge` is a client component for this reason (it's used from both trees).
  Deliberately NOT translated: server-action error messages, the .docx files
  (they follow the site's Portuguese paper forms), emails. Language, theme and
  the visit-page section modes (`show` / `collapsed` / `hidden`) are COOKIES
  (`sw_locale`, `sw_theme`, `sw_sections` — `src/app/preferences-actions.ts`),
  not database fields, so they work on the login page and need no migration.
  Dark mode is the `.dark` class on `<html>` (`@custom-variant dark` in
  `globals.css`), set from the cookie on the server and, for "match my
  device", by a tiny inline script before first paint.
- **Study colours, departments and custom document types.** `Study.color`
  is a palette id (`src/lib/study-colors.ts`); null means "auto" — always go
  through `resolveStudyColors(studies)` (oldest study first, first unused
  palette colour) rather than reading the column, so colours stay stable and
  never collide until there are more than ten studies. A patient's tone is
  DERIVED from the number at the end of their code (`patientTone`), not
  stored. `Department` is a tenant table (RLS + audit trigger were added in
  the same migration, `20260923090000_…`); a study's `departmentId` is
  nullable and `ON DELETE SET NULL`. New departments are created from the
  study add/edit forms (`resolveDepartmentId` in `studies/actions.ts` reuses
  a same-named one, case-insensitively) — there's no separate department
  screen. "Enrolled this year" counts `Subject.enrolledAt` in the current
  calendar year (UTC), "currently enrolled" counts status ENROLLED.
  `Document.typeLabel` is the user's own name for an OTHER document's type;
  it's part of the supersede match key and shown instead of "Other".
- **"Coming up this week / next week"** (`getUpcomingWeeks`): weeks run
  Monday to Sunday, counted in UTC, only SCHEDULED/RESCHEDULED visits. It
  feeds both the blue banner in `dashboard/layout.tsx` (dismissible per day,
  in `localStorage`, like the kit banner) and the Overview card.
- **Clicking the sidebar link of the section you're on refreshes it**
  (`sidebar-nav.tsx` → `router.refresh()`); a link to the current address
  does nothing on its own. If the URL has a query string (filters) the click
  navigates normally, which clears them. Settings tabs do the same.
- **Account security** (migration `20260924090000_account_security`).
  Sign-in throttling lives in `src/auth.ts`: 5 wrong passwords/codes in a row
  lock the account for 15 minutes (`User.failedLoginCount`/`lockedUntil`);
  every failure — wrong password, wrong code, unknown email, locked — looks
  identical from outside (an unknown email still spends a bcrypt check, no
  timing tell). Recording the attempts writes through `prisma-auth.ts`, which
  is part of the login bootstrap, so it's the one allowed use beyond looking
  the user up. Sessions last 8 hours (`auth.config.ts`). New passwords:
  12+ characters, ≤128, not containing the email, not one repeated character
  (`checkNewPassword`, `src/lib/password.ts`); the Security page has a
  change-password form (`changePassword` RETURNS a result code — a thrown
  server-action error is masked in production, so a form couldn't show it).
  A password an admin sets (new team member, or `resetTeamMemberPassword` —
  also the way to unlock someone; people can also use "Forgot your password?")
  sets `mustChangePassword`, which shows an amber bar until they change it;
  it's a nudge, not a forced redirect. Other sessions of the same user are
  NOT ended when a password changes (JWT sessions).
  **The audit trigger redacts `password_hash` and `mfa_secret` for `users`** —
  before this it copied whole rows, so hashes and TOTP secrets sat in
  `audit_log`; the migration scrubbed old rows. Keep that redaction if the
  trigger is ever rewritten, and redact any new secret column the same way.
- **Team and Security live under Settings** (`/dashboard/settings/team`,
  `/dashboard/settings/security`); `/dashboard/team` just redirects. The
  patient list deliberately has no I/E criteria column — they're shown only
  inside a patient's file.
- **Kits are inventory with an optional link to one visit, not a dispensing
  log.** `Kit.visitScheduleTemplateId` earmarks a visit TYPE;
  `Kit.visitId` (nullable, `ON DELETE SET NULL`) ties it to one specific
  subject's visit — always same-study, enforced in `assignKitToVisit`/
  `addKit`, not just in the pickers. `usedAt` is a soft "removed from
  inventory" (only allowed once the linked visit has an `actualDate`,
  checked server-side in `markKitUsed`); `orderedAt` acknowledges a
  replacement was ordered. Both exclude the kit from alerts/counts.
  Expiry alerts are computed, not stored: the banner
  (`getExpiringKitAlerts`, rendered by `dashboard/layout.tsx`) shows any
  kit with `expiryDate <= now + 28 days`, unordered and unused — including
  already-expired ones. "Daily" is just that: it renders on every visit, and
  "Dismiss for today" is a per-browser `localStorage` date, so it returns
  tomorrow. Constants live in `src/lib/kits.ts`.
- **Kit states, locking and the "no kits left" alert** (`src/lib/kit-stock.ts`).
  A kit is exactly one of USED (`usedAt`), ASSIGNED (`visitId` set — LOCKED to that
  patient's visit), EXPIRED (past `expiryDate`, unassigned) or AVAILABLE — always ask
  `kitState()`, don't re-derive it. The lock is enforced in `assignKitToVisit`, not
  just by hiding buttons: a kit already on another visit, expired or used can't be
  assigned; releasing (`visitId` null) is refused once the visit has an `actualDate`;
  `deleteKit` refuses an assigned kit. A study is OUT OF STOCK when it has kits on
  record and none AVAILABLE; that raises the bar in `kit-expiry-banner.tsx`
  (`getKitStockAlerts`) and, from the same daily cron as the expiry email
  (`runKitStockEmails`, every 3 days via `Study.lastKitStockEmailAt`), an email to
  every user of the organisation — until someone presses "Mark as requested"
  (`Study.kitRestockRequestedAt`). `addKit` (which now takes a quantity, max 500)
  clears that mark so the next stock-out alerts again. Expiry alerts deliberately
  still include assigned-but-unused kits (one may expire before its visit). The
  kit actions RETURN `KitResult` codes (words in `kit-problems.ts`), never throw.
- **Lab samples** (`/dashboard/samples`, `LabShipment`, tenant table with RLS +
  audit in `20260929100000_…`): one row per shipment — AWB (upper-cased, spaces
  collapsed, unique per organisation), ship date (noon UTC), and typed-in ambient /
  refrigerated / frozen counts (not derived from kits; at least one sample). A
  shipment can list the kits its samples came from (`Kit.shipmentId`, `ON DELETE SET
  NULL`): only kits of the same study that are assigned to a visit, one shipment per
  kit — a refused kit rolls the whole save back (`KitRefused` thrown inside the
  transaction). Actions return `ShipmentResult` codes (`shipment-problems.ts`).
- **The kit-expiry email job is the one place with no logged-in user.**
  `/api/cron/kit-expiry` (Vercel Cron, `vercel.json`) authenticates with
  `CRON_SECRET` as a Bearer token and refuses to run at all if that env var
  is unset. `src/lib/kit-reminders.ts` then runs through the normal
  `app_runtime` client via `withTenantContext` with a synthetic
  platform-admin context (RLS already allows that GUC to see every org) —
  do NOT reach for `prisma-auth.ts` (owner role) for this; that client is for
  the login bootstrap only. It emails all users of the kit's organization
  (not just study assignees — Team-page-created users have no assignments),
  one email per recipient, spaced 3 days via `lastExpiryEmailAt` with half a
  day of slack so a daily cron doesn't drift to every 4 days. Emails are sent
  between two short transactions, not inside one, so a slow provider can't
  hit Prisma's interactive-transaction timeout.
- **A patient is identified by the CODE ALONE — no name, no initials, no referral
  source.** `referral_source` went in migration
  `20260919090000_kits_inventory_and_patient_name`; `display_name` (the optional
  initials) went in `20260930090000_drop_patient_initials`, at the user's request,
  because the site only ever needs the code (the code-to-person list stays in the
  hospital's own records). Don't add a name/initials field back. The printed nursing
  sheet ("Iniciais:") and I/E form ("Patient initials:") keep their boxes as part of the
  paper templates and leave them BLANK for handwriting (`initials: null` in
  `queries.ts`). Deploy order for that migration was code first, migration second
  (the previous build still selected the column). Still synthetic-only data until
  Phase 5; the add-patient form says so.
- **A study is known by its acronym (`Study.protocolId`); the title is optional.** A
  blank title is stored as the acronym (`readStudyFields`), and every screen that
  prints "acronym — title" goes through `studyLabel()` (`src/lib/study-label.ts`) so it
  doesn't show the acronym twice. The EU CT number is edited beside PI name / site number
  on the study page and only feeds the I/E form footer. `addStudy` / `updateStudyCore`
  RETURN a `StudyResult` (words in `study-problems.ts`), never throw.
- **Study and Team management (`/dashboard/studies` add/edit,
  `/dashboard/settings/team`) are gated to `ORG_ADMIN`/platform admin**,
  checked both in the page (hides the UI, and the team page refuses to even
  query member data for anyone else) and again in every server action in
  `src/app/dashboard/studies/actions.ts` and
  `src/app/dashboard/settings/team/actions.ts` — the action-level check is the real
  gate, since a server action is a callable endpoint regardless of what the
  UI hides. Deleting a user (`deleteTeamMember`) can't just `user.delete` —
  `StudyAssignment.userId`, `Document.signedById`, and
  `FeedbackSubmission.submittedById` all reference `User` with no cascade.
  The action clears the user's own `StudyAssignment` rows first (safe, just
  a link) but blocks the whole delete with a friendly error if the user has
  signed documents or feedback, rather than letting a raw FK violation
  reach the client. Self-deletion is blocked outright. Add / edit / delete RETURN
  a `TeamResult` (`{ok:false, problem}`; the words are in `team-problems.ts`,
  translated) — they used to throw, and in production that shows as "Minified
  React error #441" (the masked "Server Components render" error) instead of the
  message, which is how a blocked delete of a PI with signed documents looked
  like a crash. `PLATFORM_ADMIN` is
  deliberately not an assignable role from this page — it's cross-org, not
  something one org's admin should be able to grant.

- **I/E criteria are typed and live in two places.** `Study.ieCriteria`
  (`{inclusion: string[], exclusion: string[]}`, saved from the study page's
  card via `saveStudyCriteria`) is the protocol's list; `Subject.ieCriteriaSnapshot`
  entries are `{criterion, met, type?: "I" | "E"}` (no `type` = inclusion, for
  rows saved before the split). `met` always means the criterion AS WRITTEN,
  so for an exclusion criterion `met: true` ("applies") is the BAD answer —
  `ie-criteria.tsx` inverts the colours/labels for E. `addSubject` seeds a new
  patient from the study list (not assessed, `met: null`); a patient can also
  `loadStudyCriteria` or import pasted text (`addIeCriteriaBulk`), both of
  which skip a criterion already on the list (same text + type).
- **Search** (`src/lib/search.ts`, `/api/search`, header `GlobalSearch`, results
  page `/dashboard/search`): terms split on whitespace/commas/semicolons, ALL
  must match (accent-insensitive); the DB is queried with the longest term as
  a `contains` anchor and the rest is filtered in JS. Runs under the caller's
  tenant context like any other query.
- **AI is optional and one-way out** (`src/lib/ai.ts`, env `ANTHROPIC_API_KEY`,
  optional `ANTHROPIC_MODEL`, default `claude-opus-5`). Used by
  `import-actions.ts` (pasted criteria / checklist text) and
  `dashboard/help/actions.ts` (Help assistant). Rules: never send patient data
  (only pasted protocol text and the typed help question, which the UI warns
  about); every AI feature must have a no-AI fallback (`text-import.ts` rules
  parser; the Help page lists the closest articles) and returns a result
  object, never throws; every AI reply is validated (zod) or shown as a
  suggestion the user confirms before anything is saved; per-user in-memory
  throttle in `src/lib/throttle.ts`. The Help assistant answers ONLY from
  `src/lib/help/articles.ts` — when a screen or a button name changes, update
  the matching article (and its catalog rows), or the assistant will keep
  teaching the old steps. Article `keywords` are English-only search aids.
- **Calendar sharing** (`src/lib/calendar-feed.ts`; UI `visits/calendar-share.tsx`;
  routes `/api/calendar/[token]` and `/api/calendar-download`). The
  subscription URL is fetched by Apple/Google/Microsoft with NO login, so its
  credential is the token: `org.user.version.HMAC-SHA256(AUTH_SECRET)`. Nothing
  secret is stored — `User.calendarFeedEnabled` + `calendarFeedVersion` are the
  only state; "Make a new link" bumps the version (old links die), "Turn sharing
  off" blocks them all. Every failure answers the same 404. The route reads
  through `withTenantContext` with an explicit context for the token's
  organization (like the kit cron) — never `prisma-auth.ts`. Events are all-day
  (dates are noon UTC, so the UTC day is the visit's day), carry study, patient,
  window, kits (linked to the visit; else the ones set aside for its visit type)
  and a link to `/dashboard/visits/<id>`; scope is the whole organization,
  SCHEDULED/RESCHEDULED/COMPLETED from 60 days back. Changing `AUTH_SECRET`
  invalidates every link. Patient codes end up on Google's/Microsoft's servers
  once someone subscribes — think about that before Phase 5 (real data): a
  "hide patient codes" option would be the first thing to add. The login form
  honours `?callbackUrl=` (same-origin `/dashboard…` only) so those event links
  land on the visit after sign-in.
- **I/E .docx** (`src/lib/ie-docx.ts`, `/api/subjects/[id]/ie-docx` and
  `/api/studies/[id]/ie-docx`): the site's "Checklist for verification of
  inclusion and exclusion criteria" (a SOURCE DOCUMENT), reproduced from the
  template the user supplied — IN ENGLISH, unlike the Portuguese checklist and
  nursing sheet, because that's how the template is: header with PI / Site /
  Protocol, VISIT + PATIENT box, Table 1 (inclusion) and Table 2 (exclusion) with
  Yes / No / NA / Comments, the eligibility YES/NO row, the confirmation
  sentence, a Signature / Date box, and a footer with the NA note, page number
  and "STUDY … | Version … | EU CT …, release date". Yes/No answers the
  criterion AS WRITTEN (so Yes on an exclusion = it applies). A patient copy
  ticks the recorded answers (not assessed = blank; with none recorded it falls
  back to the study's list, all blank); the study copy is blank. NA, comments,
  the eligibility row and the signature are NEVER pre-filled — eligibility is
  the investigator's call. `?visitId=` fills the VISIT box (the form is
  re-done at each visit; the visit page has the button). `Study.euCtNumber`
  (edited beside PI name / site number on the study page) feeds the footer. The
  template's "Subject History"-style category rows aren't supported: criteria
  are flat strings.
- **Visit time and monitoring visits.** `Visit.startTime` is text "HH:mm" on the
  clinic's wall clock (`src/lib/visit-time.ts`) — a floating time like the day-only
  dates, never run through a `Date`. In the calendar feed a visit with a time is a
  timed FLOATING event (no time zone; 1 h long, 2 h for monitoring — the model has
  no end time), one without is all-day. `MonitoringVisit` (study, date at noon UTC,
  time, room, notes) with `MonitoringVisitItem` points to verify (ticked, cascade
  delete) are tenant tables (RLS + audit in `20260928100000_…`). They show in the
  visit calendar (dashed chips), in the calendar feed (LOCATION = room) and in
  the weekly digest. The printed points document IS `generateChecklistDocx` with
  an optional `heading` / `columnLabels` (Portuguese, like the procedures
  checklist). All monitoring actions RETURN results (masked-error rule).
- **Weekly visit digest** (`src/lib/visit-digest.ts`, cron `/api/cron/visit-digest`,
  `vercel.json`: `0 8 * * 3,4` UTC): on Wednesdays and Thursdays, email (and SMS for
  those who opted in) the visits — patients' and monitoring — of the FOLLOWING
  Monday–Sunday. "Following week, on Wednesdays and Thursdays" was read as "sent
  on Wed/Thu about next week"; `DIGEST_WEEKDAYS` moves the days, and if it was
  meant as "only visits that fall on a Wed/Thu" filter in `runVisitDigest`. Same
  shape as the kit job: cron secret, platform-admin context via `withTenantContext`,
  never `prisma-auth.ts`. Recipients: `User.notifyEmail` (default TRUE — everyone
  gets the email once email is connected; opt out in Settings → Notifications) and
  `notifySms` + `phone` + `smsConsentAt` (SMS is opt-in only; consent time recorded).
  `lastVisitDigestAt` blocks a repeat within 20 h. Wording is per organization
  (`Organization.visitAlertTemplates`, placeholders `{name} {week} {count} {visits}
  {link}`, `visit-alert-templates.ts`), edited by org admins; texts are trimmed to
  ~480 chars. `ANY` provider missing → messages are only logged (`emailConfigured()`,
  `smsConfigured()` say so and the UI tells the user). SMS = Twilio (`sms.ts`,
  `TWILIO_*`); dates read in `DIGEST_LOCALE` (default en-GB). `phone` is personal
  data and is copied into `audit_log` by the users trigger like any other column.
- **Forgot password / request access** (public pages, `auth.config.ts`
  `PUBLIC_PAGES`). Reset: `password_reset_tokens` (only the SHA-256 is stored; 1 h;
  single use; 3 per account per hour; completing one lifts a lockout and voids the
  other links) is reachable ONLY through `prisma-auth.ts` — `app_runtime` has no
  privileges on it. The answer is identical whether or not the email has an
  account and the email goes out after it (`after()`); links are built from
  `NEXTAUTH_URL` first (a forged Host header must not steer a reset email).
  With no email service the form says so instead of pretending. Request access
  stores nothing: it emails `ACCESS_REQUEST_EMAIL` (comma-separated) with the
  requester as reply-to and a link that opens Settings → Team with the Add form
  pre-filled (`?name=&email=&role=&phone=`); it never emails the requester. Both
  have a honeypot field and per-IP throttling (in-memory, `throttle.ts`).
- **Sign-in look and brand assets.** `src/lib/brand.ts` lists `LOGO_SRC` and
  `LOGIN_IMAGES` (files in `public/brand/`, which the middleware matcher exempts):
  `sitewell-logo.png` (the supplied logo with its baked-in grid background removed
  — colour-to-alpha against white, so it's transparent and dark-blue; it needs a
  light chip on any dark surface, which `BrandLogo` adds for a coloured bar and
  in dark mode) and three login pictures, 1600 px wide. Each sign-in page load shows the picture
  after the one this browser saw last (`sw_login_seq` cookie, written by
  `LoginArt`); the logo shows on the sign-in pages and, when set, at the bottom of
  the TOP of the sidebar, where the wordmark used to be (a small mark stands in on the icon rail; on a light chip over a coloured bar). The sign-in pages are the app's look: a floating rounded picture with a caption, and one white card (uth-shell.tsx).
- **Forms that validate must use `onSubmit`, not `<form action={fn}>`.** React 19
  resets an uncontrolled form after an action, which wipes what the person typed
  when a validation error comes back. The new forms read `new FormData(e.currentTarget)`
  in an `onSubmit` handler instead.
- **The look is done with tokens, not per-page classes** (`src/app/globals.css`): the
  neutral greys are re-tinted with the LOGO's navy by overriding `--color-neutral-*` in `@theme`, the
  radii are rounder, and anything that is `rounded-lg border` is a CARD (surface colour +
  shadow, via a `@layer base` rule — a `bg-*` utility on it still wins), form controls sit
  on the surface colour, and buttons are pills (`button.rounded-md` is deliberately
  UNLAYERED so it beats the utility every button carries). Accent = `--accent` /
  `bg-accent` / `bg-accent-soft`; the logo's four colours are `bg-brand-navy/-blue/-teal/-green` (charts, marks) — no violet/lavender anywhere. ONE TYPEFACE: `--font-mono` is mapped to Geist sans and `code/kbd/pre` inherit, so patient codes, protocol IDs and times are the regular font — don't put `font-mono` back and don't add a second font. So a new screen looks right by using the usual
  `rounded-lg border border-neutral-200` card. The shell is `dashboard/layout.tsx`: a
  floating white sidebar (icons from `components/nav-icons.tsx`, the current page a dark
  pill; below `lg` it collapses to an icon rail and sign-out moves to the top bar), a
  rounded top bar that holds only the search (centred and wide — who is signed in is in the sidebar's user card), and the banners as rounded strips above it. The sidebar
  colour default is now `light`; a colour someone picked keeps working (white active pill).
- **Visits calendar** (`visits/visits-calendar.tsx`): the details of the SELECTED DAY or
  WEEK are a panel that sits above a compact month grid on a narrow screen and BESIDE it (grid in a 23rem column) from xl up (Day / Week switch, prev / today / next, the
  date-aware "+ Add visit"); each entry card shows time, visit, patient, study, status,
  window, kits (monitoring visits: room and points checked). Weeks run Monday–Sunday
  everywhere (the digest, the banner, this grid). Clicking a grid day selects it; in Week
  mode its week is the highlighted band. The old Year view was dropped. `CalendarVisit` /
  `CalendarMonitoring` carry the extra fields (window, kits, point counts).
- **Left bar colour** is the `sw_sidebar` cookie (`SIDEBAR_COLORS` in
  `src/lib/preferences.ts`); `light` means no fill (the old look), anything else
  is an inline `backgroundColor` with light text (`dark` prop on the nav).

## Before calling a change done

Run, in order: `npm run lint`, `npx tsc --noEmit`, `npm run i18n:check`,
`npm run build`. All four are clean as of this writing — keep them that way.

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
upload on the deployed site only works once the R2 settings are in Vercel
(see the storage note above); locally it uses the disk — remember which
environment you're testing against.
