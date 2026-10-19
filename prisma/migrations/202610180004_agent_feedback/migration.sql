-- Bac à sable : chaque test consomme le quota quotidien de l'offre (aucun envoi WhatsApp)
CREATE TABLE "agent_test_run" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT,
    "missingInfo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_test_run_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agent_test_run_projectId_createdAt_idx" ON "agent_test_run"("projectId", "createdAt");
ALTER TABLE "agent_test_run" ADD CONSTRAINT "agent_test_run_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_test_run" ADD CONSTRAINT "agent_test_run_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Retours de l'équipe sur les réponses de l'IA
CREATE TYPE "AiFeedbackRating" AS ENUM ('UP', 'DOWN');
CREATE TABLE "ai_feedback" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rating" "AiFeedbackRating" NOT NULL,
    "correction" TEXT CHECK (char_length("correction") BETWEEN 1 AND 4000),
    "entryId" TEXT,
    -- Correction ajoutée à la base ou écartée par un administrateur.
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ai_feedback_messageId_authorId_key" ON "ai_feedback"("messageId", "authorId");
CREATE INDEX "ai_feedback_projectId_createdAt_idx" ON "ai_feedback"("projectId", "createdAt");
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "knowledge_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Questions auxquelles l'IA n'a pas su répondre faute d'information
CREATE TYPE "KnowledgeGapStatus" AS ENUM ('OPEN', 'ANSWERED', 'DISMISSED');
CREATE TABLE "knowledge_gap" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contactId" TEXT,
    "messageId" TEXT,
    "question" TEXT NOT NULL CHECK (char_length("question") BETWEEN 1 AND 1000),
    "status" "KnowledgeGapStatus" NOT NULL DEFAULT 'OPEN',
    "entryId" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_gap_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "knowledge_gap_messageId_key" ON "knowledge_gap"("messageId");
CREATE INDEX "knowledge_gap_projectId_status_createdAt_idx" ON "knowledge_gap"("projectId", "status", "createdAt");
ALTER TABLE "knowledge_gap" ADD CONSTRAINT "knowledge_gap_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_gap" ADD CONSTRAINT "knowledge_gap_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_gap" ADD CONSTRAINT "knowledge_gap_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "knowledge_gap" ADD CONSTRAINT "knowledge_gap_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "knowledge_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "knowledge_gap" ADD CONSTRAINT "knowledge_gap_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
