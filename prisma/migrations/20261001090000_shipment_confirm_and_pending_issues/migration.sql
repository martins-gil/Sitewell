-- AlterTable
ALTER TABLE "lab_shipments" ADD COLUMN     "confirmation_sent_at" TIMESTAMP(3),
ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "confirmed_shipped" BOOLEAN,
ADD COLUMN     "not_shipped_reason" TEXT;

-- CreateTable
CREATE TABLE "pending_issues" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "study_id" TEXT,
    "text" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_issues_organization_id_idx" ON "pending_issues"("organization_id");

-- CreateIndex
CREATE INDEX "pending_issues_study_id_idx" ON "pending_issues"("study_id");

-- AddForeignKey
ALTER TABLE "pending_issues" ADD CONSTRAINT "pending_issues_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_issues" ADD CONSTRAINT "pending_issues_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "studies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
