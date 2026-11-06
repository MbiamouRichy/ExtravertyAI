-- Un seul essai gratuit par numéro WhatsApp professionnel. Le numéro n'est
-- conservé que sous forme d'empreinte HMAC, et survit à la suppression du projet.
CREATE TABLE "trial_claim" (
    "numberHash" TEXT NOT NULL,
    "projectId" TEXT,
    "subscriptionId" TEXT,
    "reservedUntil" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trial_claim_pkey" PRIMARY KEY ("numberHash")
);
