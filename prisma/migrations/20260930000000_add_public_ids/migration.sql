-- Short numeric public ids for Client, Case and Invoice (used in URLs).
--
-- These columns were added to production outside the migration history
-- (commit 679f741), so this migration was written to reproduce production's
-- actual DDL exactly, and is marked as already applied there with
-- `prisma migrate resolve --applied 20260930000000_add_public_ids`:
--   * sequence "<Table>_publicId_seq": bigint (the CREATE SEQUENCE default),
--     start 1, increment 1, OWNED BY "<Table>"."publicId"
--   * column "publicId": integer NOT NULL DEFAULT nextval('"<Table>_publicId_seq"')
--   * unique index "<Table>_publicId_key"
--
-- On any other database it adds the columns and backfills existing rows in
-- creation order before enforcing NOT NULL and uniqueness.

-- Client
CREATE SEQUENCE "Client_publicId_seq";
ALTER TABLE "Client" ADD COLUMN "publicId" INTEGER;
UPDATE "Client" AS target
SET "publicId" = numbered.row_number
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS row_number
  FROM "Client"
) AS numbered
WHERE target."id" = numbered."id";
SELECT setval('"Client_publicId_seq"', COALESCE((SELECT MAX("publicId") FROM "Client"), 0) + 1, false);
ALTER TABLE "Client"
  ALTER COLUMN "publicId" SET DEFAULT nextval('"Client_publicId_seq"'),
  ALTER COLUMN "publicId" SET NOT NULL;
ALTER SEQUENCE "Client_publicId_seq" OWNED BY "Client"."publicId";
CREATE UNIQUE INDEX "Client_publicId_key" ON "Client"("publicId");

-- Case
CREATE SEQUENCE "Case_publicId_seq";
ALTER TABLE "Case" ADD COLUMN "publicId" INTEGER;
UPDATE "Case" AS target
SET "publicId" = numbered.row_number
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS row_number
  FROM "Case"
) AS numbered
WHERE target."id" = numbered."id";
SELECT setval('"Case_publicId_seq"', COALESCE((SELECT MAX("publicId") FROM "Case"), 0) + 1, false);
ALTER TABLE "Case"
  ALTER COLUMN "publicId" SET DEFAULT nextval('"Case_publicId_seq"'),
  ALTER COLUMN "publicId" SET NOT NULL;
ALTER SEQUENCE "Case_publicId_seq" OWNED BY "Case"."publicId";
CREATE UNIQUE INDEX "Case_publicId_key" ON "Case"("publicId");

-- Invoice
CREATE SEQUENCE "Invoice_publicId_seq";
ALTER TABLE "Invoice" ADD COLUMN "publicId" INTEGER;
UPDATE "Invoice" AS target
SET "publicId" = numbered.row_number
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS row_number
  FROM "Invoice"
) AS numbered
WHERE target."id" = numbered."id";
SELECT setval('"Invoice_publicId_seq"', COALESCE((SELECT MAX("publicId") FROM "Invoice"), 0) + 1, false);
ALTER TABLE "Invoice"
  ALTER COLUMN "publicId" SET DEFAULT nextval('"Invoice_publicId_seq"'),
  ALTER COLUMN "publicId" SET NOT NULL;
ALTER SEQUENCE "Invoice_publicId_seq" OWNED BY "Invoice"."publicId";
CREATE UNIQUE INDEX "Invoice_publicId_key" ON "Invoice"("publicId");
