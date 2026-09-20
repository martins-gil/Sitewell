# SiteWell-ct

Clinical trial site platform — patients, visit scheduling, and eISF/
regulatory documents, multi-tenant from the data model up. See
[PROJECT_SPEC.md](./PROJECT_SPEC.md) for the full product spec and build
sequence; this file covers local setup and current status. The npm package
name and repo folder are still `sitepilot` — the app's own branding (title,
login page, sidebar) is "SiteWell-ct," matching the deployed domain.

**"SiteWell-ct" has not been trademark-checked** (see PROJECT_SPEC.md
section 0 / section 10). Confirm before any real commercial use — the
"-ct" suffix exists only because "sitewell" was already taken on Vercel,
not because it's part of an intended brand name; revisit before this goes
any further.

**Live deployment:** https://sitewell-ct.vercel.app (Vercel + Neon Postgres)

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
- ✅ Module 1 (Patients — renamed from "Recruitment" per pilot feedback):
  patient list with study/stage filters, an "+ Add patient" form (choose a
  study, optional subject code — auto-generated as PROTOCOL-NNNN if left
  blank — optional initials/name, editable later from the patient page;
  referral source was removed per pilot feedback; always creates the subject
  with `is_test_data: true`, no form control to override it, per
  PROJECT_SPEC.md's Phase 5 gate — the initials/name field carries the same
  "test data only" warning), patient detail page, an interactively-editable
  I/E criteria list (free-text criterion + met/not-met, not just the seeded
  snapshot)
- ✅ Postponing or bringing forward a patient's visits: on the patient page,
  every visit that hasn't happened has "Edit dates" — new date, window
  before/after, and an option to move that patient's later visits by the same
  number of days (the usual case when one visit slips). Moved visits are
  marked Rescheduled and get a fresh reminder. Completed visits are corrected
  from the visit's own page (Edit visit) instead.
- ✅ Adding a patient by copying another (Patients → "+ Add patient" → "Copy
  from an existing patient"): the source's visit schedule appears as an
  editable list — set this patient's dates and windows per visit (or "Shift
  all dates" to start the whole schedule on a given day, keeping the gaps),
  leave visits out — and the source's eligibility criteria can be copied
  too. The criteria come across as a list only: each starts as ○ "not
  assessed" (met / not met / not assessed are all settable on the patient's
  page, and a criterion can be removed) — the source patient's ✓/✗ answers
  are deliberately not inherited. The new patient's visits show on the
  calendar straight away.
- ✅ Building a patient's visit program: once a patient is pre-screened,
  screened, consented or enrolled, their page has "+ Add a visit" (pick one
  of the study's protocol visit types — or a custom-named one-off — plus a
  date; the window defaults from the protocol) and "Add all protocol visits
  from a date" (fills in only the visit types they don't have yet, dated
  from a Day 0 baseline date using the protocol offsets). The Visits
  Schedule page has "+ Add visit" too, plus a "+" on every calendar day that
  pre-fills the date: pick study → patient (only eligible ones, with
  initials and stage) → visit type (only ones that patient doesn't have) →
  date. A visit added from a protocol visit type is linked to that type, so
  it gets the same checklist/profile as an auto-generated one. A visit added
  by mistake can be removed from its own page (not once completed, not while
  documents are attached), and any visit can be edited after the fact (date,
  window, actual date, status, and the name of a custom one). The calendar
  has Day, Month and Year views: click a day number (or a marked day in the
  Year view) to see that day's visits.
- ✅ Module 2 (Visits): protocol visit-schedule builder per study
  (`/dashboard/studies/[id]/templates`), auto-generation of a subject's
  visits on enrollment, visit status actions (complete/miss/reschedule), a
  coordinator calendar with a study filter and a Month/Year toggle (Year
  shows all 12 months at once with a dot per day that has a visit; clicking
  a month or a marked day drills into Month view for it), a dedicated visit
  detail page (`/dashboard/visits/[id]`) for uploading and browsing
  documents scoped to that specific visit, and a manually-triggered
  N-days-before reminder pass (`/api/reminders/run`) that emails everyone
  assigned to the study via Resend (`src/lib/email.ts`) — falls back to
  logging to the console when `RESEND_API_KEY` isn't set (true in this
  environment; only the console path has actually been exercised — see
  CLAUDE.md).
- 🟡 Module 3 (Documents): a document is a log line first (study, type,
  title, version, optional release/expiry dates) — **attaching a file is
  optional**, at creation or later via "Attach file" on the row, so the
  register is usable even where file storage isn't (the deployed site).
  **Status is chosen when a document is added and can be changed any time**
  from the Status column (Pending / Active / Expired / Superseded); an
  Active document past its expiry date shows as Expired on its own, and
  making a document Active (adding it as Active, signing a Pending one, or
  setting it) supersedes the older Active version with the same study, type
  and title (study+visit+type+title as the matching key), local-disk storage
  (`src/lib/storage.ts` — prototype only, doesn't work on Vercel, see
  CLAUDE.md), documents can now be scoped to a specific visit as well as a
  study/subject, and status is Pending/Active/Expired/Superseded — computed
  live from `signedAt`/`expiryDate` (`src/lib/document-status.ts`) rather
  than a manually-maintained field, so it's never stale.
- ✅ Per-visit-type procedure checklists: each `VisitScheduleTemplate` (e.g.
  a study's "Baseline" visit) can define an ordered checklist of steps
  (`/dashboard/studies/[id]/templates/[templateId]/checklist`), matching the
  site's existing paper "DOCUMENTO DE APOIO PARA A IP" form. Adding an item
  picks from a reusable org-wide task library (`ChecklistTaskLibrary`) or
  types a new one, which then joins the library for next time. Every
  subject's visit of that type gets its own fill-in-able copy on the visit
  detail page, and "Download filled checklist (.docx)"
  (`src/lib/checklist-docx.ts`, the `docx` npm package) generates a real
  Word document reproducing that form's layout (the site's "V3" template —
  small-caps title over a blue rule, PI / Site Nº / Protocol Nº line,
  "Ordem de procedimentos <visit> (V3)", the three-column table with
  alternating grey rows and a ✓ in Verificado for checked items, a footnote,
  and "Protocol <Nº>, <version>, <release date>" in the page footer). Where
  the values come from: PI name and Site Nº are set on the study; the
  protocol version and release date come from the study's protocol document
  (Documents — which now has a release date and an inline Edit for version/
  release date); the "(V3)" label and footnote belong to the visit type's
  checklist. All of them are also shown and editable on each visit's page.
- ✅ Procedure date/time, visit notes, nursing sheets. Each visit type's
  checklist records either a tick ("Verificado") or when each procedure was
  done ("Data/hora") — pick which under "Edit document details" on a visit
  (it applies to every visit of that type); with "Data/hora" each procedure
  on the visit page gets a date-time field and a "Now" button (setting a time
  also ticks it). The visit's linked kits print under the checklist ("Kits:")
  and free-text visit notes ("Notas:", `Visit.notes`) print on both
  documents. Every visit has a **nursing sheet** to download
  ("Documento fonte – Registos de enfermagem"): the standard one by default,
  or the visit type's own once customised at
  `/dashboard/studies/[id]/templates/[templateId]/nursing-sheet` — sections of
  rows (vital signs, collections…) with Result / Hora / Observações columns,
  starting from one of two presets modelled on the site's paper forms. The
  visit page downloads it as a .docx (`src/lib/nursing-sheet-docx.ts`) with
  the visit name, date, subject and initials and the linked kits filled in;
  the readings themselves stay handwritten (not stored in the app). Not
  reproduced from the paper forms: hierarchical numbering (1.1), alternate
  title/footer wordings, the AVG cell.
- ✅ Kits Inventory (`/dashboard/kits`): physical/lab kits — name, study,
  expiry date, optionally earmarked for a visit type, and optionally linked
  to one specific patient visit (from the inventory row, the add form, or
  the visit's own page — a kit and its visit must be in the same study).
  Filter by study; "Show used kits" reveals ones already removed. Once a
  linked visit has an actual date, the kit can be removed from inventory as
  used (kept as a row with `usedAt`, restorable). Expiry handling:
  - Within 4 weeks of expiry (or already expired) and not marked ordered →
    an orange banner across the top of every dashboard page, back every day
    ("Dismiss for today" only hides it until tomorrow), plus a "Mark as
    ordered" button on the banner and the inventory row that clears it.
  - The same kits are emailed to every user in the organization (the address
    they log in with) every 3 days until marked ordered — one daily Vercel
    Cron run (`/api/cron/kit-expiry`, `vercel.json`) that spaces emails by
    `lastExpiryEmailAt`. Needs `CRON_SECRET` set on the project, and
    `RESEND_API_KEY` (plus a verified sending domain to reach anyone but the
    Resend account owner) to actually deliver — otherwise it logs to the
    console. See `.env.example`.
  - Overview shows how many kits expire in the next 2 months (and how many
    already have).
  Site inventory, not a full per-subject dispensing log.
- ✅ Installable on iPad/Android as a PWA — "Add to Home Screen" from Safari
  or Chrome gets an icon, a standalone (no browser chrome) window, and the
  themed status bar (`src/app/manifest.ts`, icons in `public/icons/`, the
  `appleWebApp`/`icons`/`other` block in `src/app/layout.tsx`). This is a
  home-screen shortcut to the same web app, not a native app — no App
  Store/Play Store listing, no offline mode (no service worker registered
  on purpose, since one would risk serving a stale cached UI while this is
  still under active iteration). Document upload still needs real
  networking either way, so offline support wasn't a priority yet.
- 🟡 Phase 3.5 (pilot testing) started: an in-app `/dashboard/feedback` page
  (area tested, ease-of-use rating, what was confusing/broken, suggestions)
  that any logged-in user can submit and everyone in the org can read — not
  in PROJECT_SPEC.md's data model, added because this phase needs somewhere
  for feedback to land besides a scattered chat thread. Deliberately built
  into the app itself rather than as a separate form, since real pilot
  coordinators won't have accounts in any Claude.ai organization, which a
  Claude Artifact's shared database would have required. Still open: how
  testers actually reach the app (local machine vs. deployed) — undecided.
- ✅ Study creation and editing: an "+ Add study" form on `/dashboard/studies`
  (protocol ID, title, phase, sponsor, status) and a "Study details" edit
  form on the study's visit-schedule page for fixing typos after the fact —
  both org-admin-only (`ORG_ADMIN` role or platform admin), kept as a
  separate from the "Printed on the checklist documents" card on the same
  page (PI name, site number — open to everyone, not just admins).
- ✅ Settings (`/dashboard/settings`, in the sidebar): **Preferences** —
  language (English, Français, Deutsch, Italiano, Español, Português), colour
  theme (light / dark / match my device) and, for a visit's page, whether each
  section (document details, procedure checklist, nursing sheet, notes, kits,
  documents) is shown, collapsed or hidden; **Team**; **Security**. Preferences
  are cookies (per browser, also on the sign-in page). The app's texts are
  translated through `src/lib/i18n/catalog.json` — run `npm run i18n:check`
  after adding or changing any user-facing text. The Word documents (.docx),
  the reminder emails and server-side error messages stay as they were
  (the .docx keep the site's Portuguese paper-form wording).
- ✅ Study colours and departments: every study has a colour (picked when
  adding/editing it) and the calendar shows its visits in that colour, each
  patient in a different tone of it, with a legend. Studies can be assigned
  to a department (or a new one added on the spot); the Studies page shows
  active studies, patients enrolled this year and currently enrolled, in
  total and per department. The blue "coming up" bar (and the Overview card)
  lists the visits this week and next week. I/E criteria on a patient's
  page can be shown, collapsed or hidden from Settings, and choosing "Other"
  as a document type lets you name that type.
- ✅ Account security (first Phase 5 hardening step): everyone can change
  their own password (Settings → Security; 12+ characters), 5 wrong
  sign-in attempts lock an account for 15 minutes, sessions end after 8 hours,
  and a password an admin set (new member, or "Reset password" on the Team
  tab — also how to unlock someone) is marked temporary until the user
  replaces it. The audit log no longer stores password hashes or 2FA secrets.
- ✅ Repeating visits, search, Help and text importers:
  - **Repeat a visit**: identical visits (Week 4 → Week 8) don't have to be
    rebuilt. "Repeat" on a patient's visit row (or "Repeat or copy this visit"
    on the visit page) makes a new visit of the same visit type — same
    procedures, nursing sheet and document details — with the name and date
    you give it, for the same patient or another one of the same study. A
    repeated visit can be renamed afterwards; a plain protocol visit can't.
  - **Search bar** at the top of every page (Ctrl/⌘+K): patients, visits,
    studies, documents and kits; several words narrow it down
    ("RCN-101-0009, week 4"). "See all results" opens `/dashboard/search`.
  - **Left bar colour** is a Settings preference (cookie `sw_sidebar`).
  - **Help** (`/dashboard/help`): about two dozen step-by-step answers for a
    coordinator new to the app, filterable, in all six languages, plus an
    "Ask a question" box. With `ANTHROPIC_API_KEY` set it writes an answer from
    those articles; without it it lists the closest articles.
  - **Paste-text importers**: a study's inclusion / exclusion criteria (study
    page → "Eligibility criteria (I/E)"), the same for one patient, and a
    visit type's or a single visit's procedure checklist. The pasted text is
    split into separate, editable bullet points (inclusion and exclusion apart)
    that are confirmed before anything is saved. Uses Claude when
    `ANTHROPIC_API_KEY` is set and built-in rules otherwise — see below.
  - **AI is optional and never sees patient data.** Only pasted protocol text
    and Help questions are sent (`src/lib/ai.ts`); the screens say so. Model:
    `claude-opus-5`, or whatever `ANTHROPIC_MODEL` names. It costs money per
    use, so both features are throttled per user.
- ✅ Calendar sharing, I/E document, Baseline-driven copy:
  - **Share the calendar** (Visits Schedule → "Share this calendar"): a private
    subscription link that Apple Calendar, Google Calendar and Outlook keep in
    sync, plus a one-time .ics download. Each visit shows the study, patient,
    visit, window, kits, and a link that opens that exact visit (signing in
    first if needed). The link can be replaced or switched off at any time.
    Needs the deployed site to be reachable from the internet, so it can't be
    subscribed to from `localhost`.
  - **I/E criteria as a Word document**: "Download I/E criteria (.docx)" on a
    patient (recorded answers ticked) and "Download blank I/E form (.docx)" on
    a study, in the same style as the checklist.
  - **Copying a patient**: entering the Baseline / Day 0 date places every
    protocol visit on its day from Baseline with the protocol's window (a
    repeated visit keeps its spacing).
- ✅ Team management (`/dashboard/settings/team` — the old `/dashboard/team`
  redirects; org-admin-only — hidden from the tabs
  and blocked server-side for anyone else): add a coordinator/PI/org admin
  with a temporary password they sign in with directly (no invite email or
  self-service password change yet), edit a member's name/email/role, or
  delete them. Deleting clears the member's own study assignments first but
  is blocked if they have signed documents or submitted feedback — those
  foreign keys have no cascade, and deleting anyway would silently erase
  part of the record they belong to. An admin can't delete their own
  account. Platform Admin isn't an assignable role here — it's a cross-org
  role that doesn't make sense to grant from inside one org's team page.
- ⬜ Still no UI to create a new Site independent of a study, or to change a
  user's password once set — the org admin sets it at creation time only.
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
   **This wipes every table first** (`TRUNCATE ... CASCADE` — organizations,
   users, everything) before reseeding, so it's a full reset, not an
   additive top-up. Fine for a synthetic-data prototype database; never run
   it anywhere real data could exist. Prints login credentials for the
   seeded users (all share one demo password, except the `site@...` account,
   which keeps its own password across reseeds specifically so it doesn't
   get pulled out from under whoever's actively testing with it) at the end.
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
