-- AlterTable
ALTER TABLE "kits" ADD COLUMN     "shipment_id" TEXT;

-- AlterTable
ALTER TABLE "studies" ADD COLUMN     "kit_restock_requested_at" TIMESTAMP(3),
ADD COLUMN     "last_kit_stock_email_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "lab_shipments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "study_id" TEXT NOT NULL,
    "awb" TEXT NOT NULL,
    "ship_date" TIMESTAMP(3) NOT NULL,
    "ambient_count" INTEGER NOT NULL DEFAULT 0,
    "refrigerated_count" INTEGER NOT NULL DEFAULT 0,
    "frozen_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lab_shipments_organization_id_idx" ON "lab_shipments"("organization_id");

-- CreateIndex
CREATE INDEX "lab_shipments_study_id_ship_date_idx" ON "lab_shipments"("study_id", "ship_date");

-- CreateIndex
CREATE UNIQUE INDEX "lab_shipments_organization_id_awb_key" ON "lab_shipments"("organization_id", "awb");

-- CreateIndex
CREATE INDEX "kits_shipment_id_idx" ON "kits"("shipment_id");

-- AddForeignKey
ALTER TABLE "kits" ADD CONSTRAINT "kits_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "lab_shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_shipments" ADD CONSTRAINT "lab_shipments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_shipments" ADD CONSTRAINT "lab_shipments_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "studies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
