-- Extends the RLS + audit trigger pattern from prisma/rls_and_audit.sql to
-- feedback_submissions, added after that file was written. If you add
-- another tenant-scoped table later, follow this same shape (and update the
-- table lists in prisma/rls_and_audit.sql itself so a fresh setup applies it
-- to every table, not just the ones that existed at Phase 0).

ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON feedback_submissions;
CREATE POLICY tenant_isolation_select ON feedback_submissions
  FOR SELECT
  USING (
    organization_id = current_setting('app.current_org_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

DROP POLICY IF EXISTS tenant_isolation_insert ON feedback_submissions;
CREATE POLICY tenant_isolation_insert ON feedback_submissions
  FOR INSERT
  WITH CHECK (
    organization_id = current_setting('app.current_org_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

DROP POLICY IF EXISTS tenant_isolation_update ON feedback_submissions;
CREATE POLICY tenant_isolation_update ON feedback_submissions
  FOR UPDATE
  USING (
    organization_id = current_setting('app.current_org_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    organization_id = current_setting('app.current_org_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

DROP POLICY IF EXISTS tenant_isolation_delete ON feedback_submissions;
CREATE POLICY tenant_isolation_delete ON feedback_submissions
  FOR DELETE
  USING (
    organization_id = current_setting('app.current_org_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

DROP TRIGGER IF EXISTS audit_trigger ON feedback_submissions;
CREATE TRIGGER audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON feedback_submissions
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
