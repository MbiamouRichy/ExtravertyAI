CREATE TABLE "ai_editor_request" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "state" TEXT NOT NULL CHECK ("state" IN ('started', 'completed', 'failed')),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ai_editor_request_projectId_createdAt_idx" ON "ai_editor_request"("projectId", "createdAt");
CREATE INDEX "ai_editor_request_actorId_createdAt_idx" ON "ai_editor_request"("actorId", "createdAt");
CREATE INDEX "ai_editor_request_createdAt_idx" ON "ai_editor_request"("createdAt");
