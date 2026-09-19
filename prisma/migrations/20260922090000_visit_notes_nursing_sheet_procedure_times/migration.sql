-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "visit_schedule_templates" ADD COLUMN     "checklist_column" TEXT NOT NULL DEFAULT 'VERIFIED',
ADD COLUMN     "nursing_sheet" JSONB;

-- AlterTable
ALTER TABLE "visit_checklist_results" ADD COLUMN     "performed_at" TIMESTAMP(3);
