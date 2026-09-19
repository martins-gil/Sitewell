-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failed_login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_changed_at" TIMESTAMP(3);


-- The audit trigger used to copy every column of a changed row into audit_log,
-- which for "users" meant bcrypt password hashes and TOTP secrets sat in the
-- log in plain JSON. Redact them (the change itself is still logged), and
-- scrub what was already recorded. Same function as in
-- prisma/rls_and_audit.sql, plus the redaction.
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

UPDATE audit_log
SET before = before - 'password_hash' - 'mfa_secret',
    after = after - 'password_hash' - 'mfa_secret'
WHERE table_name = 'users';