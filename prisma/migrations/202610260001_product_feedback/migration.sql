-- Retours envoyés depuis l'application : bug, idée ou compliment.
CREATE TYPE "ProductFeedbackKind" AS ENUM ('BUG', 'IDEA', 'PRAISE');

CREATE TABLE "product_feedback" (
    "id" TEXT NOT NULL,
    "kind" "ProductFeedbackKind" NOT NULL,
    "message" TEXT NOT NULL,
    "pagePath" TEXT,
    "contactOk" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_feedback_userId_createdAt_idx" ON "product_feedback"("userId", "createdAt");
CREATE INDEX "product_feedback_createdAt_idx" ON "product_feedback"("createdAt");

ALTER TABLE "product_feedback" ADD CONSTRAINT "product_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_feedback" ADD CONSTRAINT "product_feedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
