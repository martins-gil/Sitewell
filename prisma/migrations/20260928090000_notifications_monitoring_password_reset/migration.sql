-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "visit_alert_templates" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_visit_digest_at" TIMESTAMP(3),
ADD COLUMN     "notify_email" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_sms" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "sms_consent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "start_time" TEXT;

-- CreateTable
CREATE TABLE "monitoring_visits" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "study_id" TEXT NOT NULL,
    "visit_date" TIMESTAMP(3) NOT NULL,
    "start_time" TEXT,
    "room" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitoring_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring_visit_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "monitoring_visit_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitoring_visit_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monitoring_visits_organization_id_visit_date_idx" ON "monitoring_visits"("organization_id", "visit_date");

-- CreateIndex
CREATE INDEX "monitoring_visits_study_id_idx" ON "monitoring_visits"("study_id");

-- CreateIndex
CREATE INDEX "monitoring_visit_items_monitoring_visit_id_idx" ON "monitoring_visit_items"("monitoring_visit_id");

-- CreateIndex
CREATE INDEX "monitoring_visit_items_organization_id_idx" ON "monitoring_visit_items"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "monitoring_visits" ADD CONSTRAINT "monitoring_visits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_visits" ADD CONSTRAINT "monitoring_visits_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "studies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_visit_items" ADD CONSTRAINT "monitoring_visit_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_visit_items" ADD CONSTRAINT "monitoring_visit_items_monitoring_visit_id_fkey" FOREIGN KEY ("monitoring_visit_id") REFERENCES "monitoring_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
