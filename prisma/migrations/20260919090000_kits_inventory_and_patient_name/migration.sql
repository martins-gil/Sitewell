-- AlterTable
ALTER TABLE "kits" ADD COLUMN     "last_expiry_email_at" TIMESTAMP(3),
ADD COLUMN     "ordered_at" TIMESTAMP(3),
ADD COLUMN     "used_at" TIMESTAMP(3),
ADD COLUMN     "visit_id" TEXT;

-- AlterTable (referral source removed from patients per pilot feedback —
-- this drops the column and whatever values it held)
ALTER TABLE "subjects" DROP COLUMN "referral_source",
ADD COLUMN     "display_name" TEXT;

-- CreateIndex
CREATE INDEX "kits_visit_id_idx" ON "kits"("visit_id");

-- AddForeignKey
ALTER TABLE "kits" ADD CONSTRAINT "kits_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
