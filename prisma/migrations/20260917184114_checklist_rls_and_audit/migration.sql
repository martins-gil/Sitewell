-- RLS + audit trigger for the two checklist tables added alongside them
-- (checklist_template_items, visit_checklist_results). Same shape as every
-- other tenant table — see prisma/rls_and_audit.sql for the pattern this
-- copies.

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('checklist_template_items', 'organization_id'),
      ('visit_checklist_results', 'organization_id')
    ) AS x(table_name, org_column)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.table_name);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON %I FOR SELECT USING (%I::text = current_setting(''app.current_org_id'', true) OR current_setting(''app.is_platform_admin'', true) = ''true'')',
      t.table_name, t.org_column);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_insert ON %I FOR INSERT WITH CHECK (%I::text = current_setting(''app.current_org_id'', true) OR current_setting(''app.is_platform_admin'', true) = ''true'')',
      t.table_name, t.org_column);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_update ON %I FOR UPDATE USING (%I::text = current_setting(''app.current_org_id'', true) OR current_setting(''app.is_platform_admin'', true) = ''true'') WITH CHECK (%I::text = current_setting(''app.current_org_id'', true) OR current_setting(''app.is_platform_admin'', true) = ''true'')',
      t.table_name, t.org_column, t.org_column);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_delete ON %I FOR DELETE USING (%I::text = current_setting(''app.current_org_id'', true) OR current_setting(''app.is_platform_admin'', true) = ''true'')',
      t.table_name, t.org_column);

    EXECUTE format('DROP TRIGGER IF EXISTS audit_trigger ON %I', t.table_name);
    EXECUTE format(
      'CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()',
      t.table_name);
  END LOOP;
END
$$;
