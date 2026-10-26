-- Back-office : suivi des retours produit par l'équipe et journal d'audit.
CREATE TYPE "ProductFeedbackStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE', 'ARCHIVED');

ALTER TABLE "product_feedback"
    ADD COLUMN "status" "ProductFeedbackStatus" NOT NULL DEFAULT 'NEW',
    ADD COLUMN "handledAt" TIMESTAMP(3),
    ADD COLUMN "handledById" TEXT,
    ADD COLUMN "internalNote" TEXT;

CREATE INDEX "product_feedback_status_createdAt_idx" ON "product_feedback"("status", "createdAt");

ALTER TABLE "product_feedback" ADD CONSTRAINT "product_feedback_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "admin_audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_log_createdAt_idx" ON "admin_audit_log"("createdAt");
CREATE INDEX "admin_audit_log_targetType_targetId_createdAt_idx" ON "admin_audit_log"("targetType", "targetId", "createdAt");
