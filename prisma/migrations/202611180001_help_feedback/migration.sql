-- Votes « Cet article vous a-t-il aidé ? » du centre d'aide public (/aide),
-- suivis par l'équipe dans le back-office (/admin/aide).
CREATE TYPE "HelpFeedbackReason" AS ENUM ('UNCLEAR', 'MISSING_STEP', 'SCREEN_MISMATCH', 'OTHER');
CREATE TYPE "HelpFeedbackStatus" AS ENUM ('NEW', 'DONE', 'ARCHIVED');

CREATE TABLE "help_feedback" (
    "id" TEXT NOT NULL,
    "articleSlug" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "reason" "HelpFeedbackReason",
    "comment" TEXT,
    "visitorHash" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "HelpFeedbackStatus" NOT NULL DEFAULT 'NEW',
    "handledAt" TIMESTAMP(3),
    "handledById" TEXT,
    "internalNote" TEXT,

    CONSTRAINT "help_feedback_pkey" PRIMARY KEY ("id"),
    -- Un vote positif ne porte ni motif ni commentaire ; un commentaire reste court.
    CONSTRAINT "help_feedback_reason_check" CHECK ("helpful" = false OR ("reason" IS NULL AND "comment" IS NULL)),
    CONSTRAINT "help_feedback_comment_length_check" CHECK ("comment" IS NULL OR char_length("comment") <= 500),
    CONSTRAINT "help_feedback_slug_check" CHECK ("articleSlug" ~ '^[a-z0-9-]{1,60}$')
);

CREATE UNIQUE INDEX "help_feedback_articleSlug_visitorHash_key" ON "help_feedback"("articleSlug", "visitorHash");
CREATE INDEX "help_feedback_createdAt_idx" ON "help_feedback"("createdAt");
CREATE INDEX "help_feedback_articleSlug_createdAt_idx" ON "help_feedback"("articleSlug", "createdAt");
CREATE INDEX "help_feedback_helpful_status_createdAt_idx" ON "help_feedback"("helpful", "status", "createdAt");

ALTER TABLE "help_feedback" ADD CONSTRAINT "help_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "help_feedback" ADD CONSTRAINT "help_feedback_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
