-- Document status used to be computed at read time from signed_at and
-- expiry_date, with the stored value only meaning SUPERSEDED. It is now set by
-- people (chosen when a document is added, changeable afterwards), so the
-- stored value has to carry what the computed rule used to show. Convert
-- existing rows so nothing on screen changes:
--   expired (expiry date passed)      -> EXPIRED
--   not yet signed, not expired       -> DRAFT (displayed as "Pending")
-- Everything else stays ACTIVE (signed and in force); SUPERSEDED and EXPIRED
-- rows are already correct. No schema change.
UPDATE "documents"
SET "status" = 'EXPIRED'
WHERE "status" = 'ACTIVE' AND "expiry_date" IS NOT NULL AND "expiry_date" < now();

UPDATE "documents"
SET "status" = 'DRAFT'
WHERE "status" = 'ACTIVE' AND "signed_at" IS NULL;
