-- Essai terminé dès son dernier message (lib/trial-end.ts) : le premier mois est
-- prélevé tout de suite sur la carte enregistrée, au lieu d'attendre la fin des
-- jours d'essai. Seuls les essais ouverts à partir de cette version sont
-- concernés ("endsOnQuota") : un essai en cours garde les conditions acceptées
-- à son ouverture. Migration additive : aucune donnée existante n'est modifiée.
ALTER TABLE "quota_period" ADD COLUMN "endsOnQuota" BOOLEAN NOT NULL DEFAULT false;

-- Suivi de la demande faite à Polar, une seule à la fois par essai :
-- PENDING (à faire), REQUESTING (en cours, bail jusqu'à "trialEndDueAt"),
-- DONE (essai terminé chez Polar), PAYMENT_FAILED (carte refusée : l'essai
-- continue), CANCELLED (essai résilié : aucun prélèvement, revérifié de temps
-- en temps au cas où il serait réactivé), FAILED (refus définitif, à voir par
-- le support).
ALTER TABLE "quota_period" ADD COLUMN "trialEndStatus" TEXT;
ALTER TABLE "quota_period" ADD COLUMN "trialEndDueAt" TIMESTAMP(3);
ALTER TABLE "quota_period" ADD COLUMN "trialEndAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "quota_period" ADD CONSTRAINT "quota_period_trialEndStatus_check" CHECK (
  "trialEndStatus" IS NULL
  OR "trialEndStatus" IN ('PENDING', 'REQUESTING', 'DONE', 'PAYMENT_FAILED', 'CANCELLED', 'FAILED')
);
ALTER TABLE "quota_period" ADD CONSTRAINT "quota_period_trialEndAttempts_check" CHECK ("trialEndAttempts" >= 0);

-- Lu par le worker de facturation à chaque tour : seulement les essais en cours concernés.
CREATE INDEX "quota_period_trial_end_idx" ON "quota_period" ("trialEndDueAt")
  WHERE "endsOnQuota" AND "isCurrent" AND kind = 'trialing';
