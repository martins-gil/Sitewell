-- CreateEnum
CREATE TYPE "FeedbackArea" AS ENUM ('RECRUITMENT', 'VISITS', 'DOCUMENTS', 'STUDIES', 'LOGIN_AND_SECURITY', 'OTHER');

-- CreateTable
CREATE TABLE "feedback_submissions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "submitted_by_id" TEXT NOT NULL,
    "area" "FeedbackArea" NOT NULL,
    "confusing" TEXT,
    "broken" TEXT,
    "suggestion" TEXT,
    "ease_of_use_rating" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_submissions_organization_id_idx" ON "feedback_submissions"("organization_id");

-- AddForeignKey
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
