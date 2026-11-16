-- Messages au-delà du quota mensuel, payés d'avance par des recharges Polar.
-- Crédit en dix-millièmes de dollar, jamais négatif : le serveur le décompte
-- au tarif de l'offre du projet (lib/message-credit.ts).
ALTER TABLE "project" ADD COLUMN "extraCredit" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "project" ADD CONSTRAINT "project_extraCredit_check" CHECK ("extraCredit" >= 0);

-- Messages envoyés au-delà de "limit" sur la période. Le plafond (au plus "limit"
-- de plus) est appliqué par le code : une contrainte bloquerait la baisse de "limit".
ALTER TABLE "quota_period" ADD COLUMN "extraUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "quota_period" ADD CONSTRAINT "quota_period_extraUsed_check" CHECK ("extraUsed" >= 0);

-- Une ligne par commande Polar : un webhook rejoué ne crédite jamais deux fois.
CREATE TABLE "message_credit_purchase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "credit" INTEGER NOT NULL,
    "refunded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_credit_purchase_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "message_credit_purchase_amounts_check" CHECK ("credit" >= 0 AND "refunded" >= 0 AND "refunded" <= "credit")
);

CREATE UNIQUE INDEX "message_credit_purchase_orderId_key" ON "message_credit_purchase"("orderId");
CREATE INDEX "message_credit_purchase_projectId_createdAt_idx" ON "message_credit_purchase"("projectId", "createdAt");

ALTER TABLE "message_credit_purchase" ADD CONSTRAINT "message_credit_purchase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
