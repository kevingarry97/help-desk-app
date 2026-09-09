-- Admin-controlled display order for the /users list.
--
-- The default is a sequence, not a constant: a user created after an admin has arranged
-- the list has to land at the end of it. With `DEFAULT 0` every new account would sort
-- ahead of every arranged one.

-- CreateSequence
CREATE SEQUENCE "user_sortOrder_seq" AS integer;

-- AlterTable
ALTER TABLE "user" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT nextval('"user_sortOrder_seq"');

-- Tie the sequence to the column so dropping the column drops the sequence with it.
ALTER SEQUENCE "user_sortOrder_seq" OWNED BY "user"."sortOrder";

-- Backfill: existing rows keep creation order, which is what the list showed before this
-- column existed. `id` breaks ties so the result is deterministic.
WITH ordered AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS position
  FROM "user"
)
UPDATE "user"
SET "sortOrder" = ordered.position::integer
FROM ordered
WHERE "user"."id" = ordered."id";

-- Restart the sequence past the backfilled rows so the next INSERT still sorts last.
SELECT setval('"user_sortOrder_seq"', (SELECT COALESCE(max("sortOrder"), 0) FROM "user") + 1, false);

-- CreateIndex
CREATE INDEX "user_sortOrder_idx" ON "user"("sortOrder");
