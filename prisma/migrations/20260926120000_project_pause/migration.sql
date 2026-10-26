ALTER TABLE "project" ADD COLUMN "statusBeforePause" "ProjectStatus";

-- Preserve existing manually paused projects and their billing eligibility.
UPDATE "project" SET "statusBeforePause" = status, status = 'paused'
WHERE "automationPaused" = true AND "deletionPending" = false;
