-- Tokens et coût de chaque appel au modèle (OpenRouter), par projet et par usage.
-- Le projet supprimé laisse ses lignes sans projet : le coût total reste juste.
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "feature" TEXT NOT NULL CHECK (char_length("feature") BETWEEN 1 AND 40),
    "model" TEXT NOT NULL CHECK (char_length("model") BETWEEN 1 AND 200),
    "promptTokens" INTEGER NOT NULL DEFAULT 0 CHECK ("promptTokens" >= 0),
    "completionTokens" INTEGER NOT NULL DEFAULT 0 CHECK ("completionTokens" >= 0),
    "cachedTokens" INTEGER NOT NULL DEFAULT 0 CHECK ("cachedTokens" >= 0),
    -- Millionièmes de dollar ; inconnu si le fournisseur ne l'a pas communiqué.
    "costMicros" INTEGER CHECK ("costMicros" >= 0),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_usage_createdAt_idx" ON "ai_usage"("createdAt");
CREATE INDEX "ai_usage_projectId_createdAt_idx" ON "ai_usage"("projectId", "createdAt");
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
