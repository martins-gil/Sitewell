-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "release_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "visit_schedule_templates" ADD COLUMN     "checklist_footnote" TEXT,
ADD COLUMN     "checklist_version" TEXT;

-- The protocol version and release date printed on checklist documents now
-- come from each study's PROTOCOL document rather than two fields on the
-- study. Carry over whatever was entered on the study, so the documents print
-- exactly what they printed before.
--
-- studies.protocol_amendment / studies.protocol_date are deliberately NOT
-- dropped here: the code currently live still reads them, so dropping them
-- in the same step would break the site between running this migration and
-- the new deploy finishing. They stay (unused) until a follow-up migration
-- removes them.
UPDATE "documents" d
SET "release_date" = s."protocol_date",
    "version" = COALESCE(NULLIF(s."protocol_amendment", ''), d."version")
FROM "studies" s
WHERE d."study_id" = s."id"
  AND d."type" = 'PROTOCOL'
  AND d."status" <> 'SUPERSEDED'
  AND (s."protocol_date" IS NOT NULL OR s."protocol_amendment" IS NOT NULL);
