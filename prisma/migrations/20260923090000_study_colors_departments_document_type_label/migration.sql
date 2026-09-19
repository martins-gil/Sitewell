-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "type_label" TEXT;

-- AlterTable
ALTER TABLE "studies" ADD COLUMN     "color" TEXT,
ADD COLUMN     "department_id" TEXT;

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "departments_organization_id_idx" ON "departments"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_organization_id_name_key" ON "departments"("organization_id", "name");

-- CreateIndex
CREATE INDEX "studies_department_id_idx" ON "studies"("department_id");

-- AddForeignKey
ALTER TABLE "studies" ADD CONSTRAINT "studies_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-level security and the audit trigger for the new tenant-scoped table
-- (same shape as 20260917145344_feedback_rls_and_audit; see CLAUDE.md, "Adding
-- a new tenant-scoped table").
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON departments;
CREATE POLICY tenant_isolation_select ON departments
  FOR SELECT
  USING (
    organization_id = current_setting('app.current_org_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

DROP POLICY IF EXISTS tenant_isolation_insert ON departments;
CREATE POLICY tenant_isolation_insert ON departments
  FOR INSERT
  WITH CHECK (
    organization_id = current_setting('app.current_org_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

DROP POLICY IF EXISTS tenant_isolation_update ON departments;
CREATE POLICY tenant_isolation_update ON departments
  FOR UPDATE
  USING (
    organization_id = current_setting('app.current_org_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    organization_id = current_setting('app.current_org_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

DROP POLICY IF EXISTS tenant_isolation_delete ON departments;
CREATE POLICY tenant_isolation_delete ON departments
  FOR DELETE
  USING (
    organization_id = current_setting('app.current_org_id', true)
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

DROP TRIGGER IF EXISTS audit_trigger ON departments;
CREATE TRIGGER audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON departments
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();