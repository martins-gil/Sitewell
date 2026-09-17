-- AlterTable
ALTER TABLE "studies" ADD COLUMN     "pi_name" TEXT,
ADD COLUMN     "protocol_date" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "checklist_task_library" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_task_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kits" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "study_id" TEXT NOT NULL,
    "visit_schedule_template_id" TEXT,
    "name" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checklist_task_library_organization_id_idx" ON "checklist_task_library"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_task_library_organization_id_label_key" ON "checklist_task_library"("organization_id", "label");

-- CreateIndex
CREATE INDEX "kits_organization_id_idx" ON "kits"("organization_id");

-- CreateIndex
CREATE INDEX "kits_study_id_idx" ON "kits"("study_id");

-- AddForeignKey
ALTER TABLE "checklist_task_library" ADD CONSTRAINT "checklist_task_library_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kits" ADD CONSTRAINT "kits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kits" ADD CONSTRAINT "kits_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "studies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kits" ADD CONSTRAINT "kits_visit_schedule_template_id_fkey" FOREIGN KEY ("visit_schedule_template_id") REFERENCES "visit_schedule_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
