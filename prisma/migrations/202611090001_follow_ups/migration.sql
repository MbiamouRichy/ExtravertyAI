-- Relances automatiques des prospects silencieux (offre Business), désactivées par défaut.
ALTER TABLE "project"
  ADD COLUMN "followUpEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "followUpInterestedDays" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "followUpQuoteDays" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "followUpMax" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "followUpTemplate" TEXT NOT NULL DEFAULT '';

-- Mêmes bornes que le formulaire et l'action serveur (lib/follow-ups-shared.ts).
ALTER TABLE "project"
  ADD CONSTRAINT "project_follow_up_interested_days_check" CHECK ("followUpInterestedDays" BETWEEN 0 AND 14),
  ADD CONSTRAINT "project_follow_up_quote_days_check" CHECK ("followUpQuoteDays" BETWEEN 0 AND 14),
  ADD CONSTRAINT "project_follow_up_max_check" CHECK ("followUpMax" BETWEEN 1 AND 3),
  ADD CONSTRAINT "project_follow_up_template_length_check" CHECK (char_length("followUpTemplate") <= 500);

ALTER TABLE "contact"
  ADD COLUMN "followUpLeaseToken" TEXT,
  ADD COLUMN "followUpLeaseUntil" TIMESTAMP(3),
  ADD COLUMN "followUpDeclinedAt" TIMESTAMP(3);
