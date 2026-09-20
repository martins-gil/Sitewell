-- AlterTable
ALTER TABLE "users" ADD COLUMN     "calendar_feed_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "calendar_feed_version" INTEGER NOT NULL DEFAULT 0;
