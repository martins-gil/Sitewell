-- Follow-up to 20261001090000_shipment_confirm_and_pending_issues (hand-written, like the
-- other *_rls_and_audit migrations — Prisma can't express any of this).
--
-- pending_issues is a tenant table: same row-level security policies and audit trigger as
-- every other one (copied from prisma/rls_and_audit.sql; that file's two table lists are
-- updated too, so a fresh setup gets them).

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['pending_issues']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON %I FOR SELECT USING (organization_id = current_setting(''app.current_org_id'', true) OR current_setting(''app.is_platform_admin'', true) = ''true'')',
      t);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_insert ON %I FOR INSERT WITH CHECK (organization_id = current_setting(''app.current_org_id'', true) OR current_setting(''app.is_platform_admin'', true) = ''true'')',
      t);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_update ON %I FOR UPDATE USING (organization_id = current_setting(''app.current_org_id'', true) OR current_setting(''app.is_platform_admin'', true) = ''true'') WITH CHECK (organization_id = current_setting(''app.current_org_id'', true) OR current_setting(''app.is_platform_admin'', true) = ''true'')',
      t);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_delete ON %I FOR DELETE USING (organization_id = current_setting(''app.current_org_id'', true) OR current_setting(''app.is_platform_admin'', true) = ''true'')',
      t);

    EXECUTE format('DROP TRIGGER IF EXISTS audit_trigger ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()',
      t);
  END LOOP;
END
$$;
