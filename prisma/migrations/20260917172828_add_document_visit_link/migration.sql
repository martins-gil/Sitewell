-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "visit_id" TEXT;

-- CreateIndex
CREATE INDEX "documents_visit_id_idx" ON "documents"("visit_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
