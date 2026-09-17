-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "site_number" TEXT;

-- AlterTable
ALTER TABLE "studies" ADD COLUMN     "protocol_amendment" TEXT;

-- CreateTable
CREATE TABLE "checklist_template_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "visit_schedule_template_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_checklist_results" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "template_item_id" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_checklist_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checklist_template_items_organization_id_idx" ON "checklist_template_items"("organization_id");

-- CreateIndex
CREATE INDEX "checklist_template_items_visit_schedule_template_id_idx" ON "checklist_template_items"("visit_schedule_template_id");

-- CreateIndex
CREATE INDEX "visit_checklist_results_organization_id_idx" ON "visit_checklist_results"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "visit_checklist_results_visit_id_template_item_id_key" ON "visit_checklist_results"("visit_id", "template_item_id");

-- AddForeignKey
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_visit_schedule_template_id_fkey" FOREIGN KEY ("visit_schedule_template_id") REFERENCES "visit_schedule_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_checklist_results" ADD CONSTRAINT "visit_checklist_results_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_checklist_results" ADD CONSTRAINT "visit_checklist_results_template_item_id_fkey" FOREIGN KEY ("template_item_id") REFERENCES "checklist_template_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_checklist_results" ADD CONSTRAINT "visit_checklist_results_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
