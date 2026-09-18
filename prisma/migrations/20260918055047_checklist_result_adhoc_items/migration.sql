-- DropForeignKey
ALTER TABLE "visit_checklist_results" DROP CONSTRAINT "visit_checklist_results_template_item_id_fkey";

-- AlterTable (label added nullable for now — backfilled below, then made required)
ALTER TABLE "visit_checklist_results"
  ADD COLUMN     "detail" TEXT,
  ADD COLUMN     "label" TEXT,
  ADD COLUMN     "removed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
  ALTER COLUMN "template_item_id" DROP NOT NULL;

-- Backfill label/detail/sort_order on existing rows from the template item
-- they were generated from, so already-seeded checklist results keep their
-- text now that it's denormalized onto this table instead of always joined.
UPDATE "visit_checklist_results" r
SET "label" = t."label",
    "detail" = t."detail",
    "sort_order" = t."sort_order"
FROM "checklist_template_items" t
WHERE r."template_item_id" = t."id";

-- Every row now has a label (existing rows backfilled above, and the
-- application always sets it for new rows, template-derived or ad-hoc).
ALTER TABLE "visit_checklist_results" ALTER COLUMN "label" SET NOT NULL;

-- AddForeignKey (ON DELETE SET NULL, not the default RESTRICT: deleting a
-- ChecklistTemplateItem should detach already-recorded visit checklist rows
-- rather than force-delete them, so a visit's already-checked history for
-- that step survives even after it's removed from the template).
ALTER TABLE "visit_checklist_results" ADD CONSTRAINT "visit_checklist_results_template_item_id_fkey" FOREIGN KEY ("template_item_id") REFERENCES "checklist_template_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
