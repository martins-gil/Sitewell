-- Patients are identified by their code alone: the optional initials / name column is
-- removed, so nothing that identifies a person can be stored against a patient.
-- (Only synthetic test initials were ever in it.)
--
-- Deploy order: push the code that no longer reads the column FIRST, then apply this —
-- the previous version of the app still selects display_name.

ALTER TABLE "subjects" DROP COLUMN "display_name";
