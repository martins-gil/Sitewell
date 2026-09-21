-- =============================================================================
-- Row-level security (organization_id isolation) + append-only audit trigger.
--
-- HOW TO APPLY: Prisma's schema language can't express RLS policies or
-- triggers, so this isn't a normal `prisma migrate dev` migration. Once you
-- have a live DATABASE_URL/DIRECT_URL (see .env.example):
--
--   1. npx prisma migrate dev --name init            (creates the tables)
--   2. npx prisma migrate dev --create-only --name rls_and_audit
--   3. paste this file's contents into the generated
--      prisma/migrations/<timestamp>_rls_and_audit/migration.sql
--   4. npx prisma migrate dev                         (applies it)
--
-- Replace CHANGE_ME_STRONG_PASSWORD below before running against anything
-- other than a throwaway dev database, then put the app_runtime credentials
-- into DATABASE_URL and keep the owner/DIRECT_URL credentials for migrations
-- only.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Least-privilege runtime role.
--
-- Postgres table OWNERS always bypass RLS. Since `prisma migrate` runs (and
-- therefore owns the tables) as the DIRECT_URL/owner role, the app itself
-- must connect as a *different*, non-owner role for RLS to actually apply.
-- app_runtime is that role — it's what DATABASE_URL should point at.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime WITH LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD' NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;

-- audit_log is append-only: app_runtime can read it, but only the trigger
-- below (running SECURITY DEFINER as the table owner) can write to it.
REVOKE INSERT, UPDATE, DELETE ON audit_log FROM app_runtime;

-- -----------------------------------------------------------------------------
-- 2. Row-level security policies.
--
-- Every app query must run inside a transaction that first sets these two
-- session variables (see src/lib/db-context.ts):
--   app.current_org_id     — the caller's organization_id
--   app.is_platform_admin  — 'true' for cross-org Platform Admin support access
--
-- Looped via dynamic SQL instead of writing ~40 near-identical CREATE POLICY
-- statements by hand — same policy shape on every tenant table, so a typo in
-- one copy-pasted version wouldn't be enforced consistently.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('organizations', 'id'),
      ('users', 'organization_id'),
      ('studies', 'organization_id'),
      ('sites', 'organization_id'),
      ('study_assignments', 'organization_id'),
      ('subjects', 'organization_id'),
      ('visit_schedule_templates', 'organization_id'),
      ('visits', 'organization_id'),
      ('documents', 'organization_id'),
      ('feedback_submissions', 'organization_id'),
      ('checklist_template_items', 'organization_id'),
      ('visit_checklist_results', 'organization_id'),
      ('checklist_task_library', 'organization_id'),
      ('kits', 'organization_id'),
      ('departments', 'organization_id'),
      ('monitoring_visits', 'organization_id'),
      ('monitoring_visit_items', 'organization_id'),
      ('lab_shipments', 'organization_id')
    ) AS x(table_name, org_column)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.table_name);

    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation_select ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON %I FOR SELECT USING (%I::text = current_setting(''app.current_org_id'', true) OR current_setting(''app.is_platform_admin'', true) = ''true'')',
      t.table_name, t.org_column);

    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation_insert ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_insert ON %I FOR INSERT WITH CHECK (%I::text = current_setting(''app.current_org_id'', true) OR current_setting(''app.is_platform_admin'', true) = ''true'')',
      t.table_name, t.org_column);

    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation_update ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_update ON %I FOR UPDATE USING (%I::text = current_setting(''app.current_org_id'', true) OR current_setting(''app.is_platform_admin'', true) = ''true'') WITH CHECK (%I::text = current_setting(''app.current_org_id'', true) OR current_setting(''app.is_platform_admin'', true) = ''true'')',
      t.table_name, t.org_column, t.org_column);

    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation_delete ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_delete ON %I FOR DELETE USING (%I::text = current_setting(''app.current_org_id'', true) OR current_setting(''app.is_platform_admin'', true) = ''true'')',
      t.table_name, t.org_column);
  END LOOP;
END
$$;

-- audit_log: read-only for app_runtime (no write grants at all — see above),
-- but still scope what it can SELECT.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON audit_log;
CREATE POLICY tenant_isolation_select ON audit_log
  FOR SELECT
  USING (
    organization_id = current_setting('app.current_org_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- -----------------------------------------------------------------------------
-- 3. Append-only audit trigger.
--
-- SECURITY DEFINER + owned by the table owner: app_runtime has no direct
-- write grant on audit_log, so the only way a row lands there is through
-- this trigger firing on a tracked table. That's what makes the log
-- trustworthy — no app code path (or bug) can edit or delete history.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id TEXT := NULLIF(current_setting('app.current_user_id', true), '');
  v_row JSONB;
  v_before JSONB;
  v_after JSONB;
  v_org_id TEXT;
  v_record_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
  ELSE
    v_row := to_jsonb(NEW);
  END IF;

  v_record_id := v_row->>'id';

  IF TG_TABLE_NAME = 'organizations' THEN
    v_org_id := v_row->>'id';
  ELSE
    v_org_id := v_row->>'organization_id';
  END IF;

  v_before := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_after := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;

  -- Never copy credentials into the log (the change itself is still recorded).
  IF TG_TABLE_NAME = 'users' THEN
    v_before := v_before - 'password_hash' - 'mfa_secret';
    v_after := v_after - 'password_hash' - 'mfa_secret';
  END IF;

  INSERT INTO audit_log (id, organization_id, table_name, record_id, action, actor_id, before, after)
  VALUES (
    gen_random_uuid()::text,
    v_org_id,
    TG_TABLE_NAME,
    v_record_id,
    TG_OP::"AuditAction",
    v_actor_id,
    v_before,
    v_after
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'organizations', 'users', 'studies', 'sites', 'study_assignments',
    'subjects', 'visit_schedule_templates', 'visits', 'documents',
    'feedback_submissions', 'checklist_template_items', 'visit_checklist_results',
    'checklist_task_library', 'kits', 'departments',
    'monitoring_visits', 'monitoring_visit_items', 'lab_shipments'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_trigger ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()',
      tbl);
  END LOOP;
END
$$;

-- password_reset_tokens is NOT a tenant table: only the owner-role sign-in client touches it,
-- so the app's normal role gets nothing (RLS on with no policy, and no privileges).
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON password_reset_tokens FROM app_runtime;
