CREATE TYPE "InstinctClassification" AS ENUM ('interesting', 'follow_up', 'none');
ALTER TABLE "contact" ADD COLUMN "instinctClassification" "InstinctClassification";
-- Null classifications are deliberately re-evaluated by the new worker.
