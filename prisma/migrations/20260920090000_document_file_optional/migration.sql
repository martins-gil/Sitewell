-- AlterTable
-- A document can now be logged without a file (attaching one is optional).
-- Relaxing NOT NULL is safe for the code that's live during rollout: it never
-- creates a document without a file, so no NULLs appear until the new code is
-- serving.
ALTER TABLE "documents" ALTER COLUMN "file_url" DROP NOT NULL;
