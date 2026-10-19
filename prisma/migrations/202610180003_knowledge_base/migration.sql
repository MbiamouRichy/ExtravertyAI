-- Base de connaissances : sources importées (PDF, page web, CSV) et entrées interrogeables
CREATE TYPE "KnowledgeKind" AS ENUM ('FAQ', 'TEXT', 'PRODUCT', 'CHUNK');
CREATE TYPE "KnowledgeSourceType" AS ENUM ('PDF', 'URL', 'CSV');
CREATE TYPE "KnowledgeSourceStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED');

CREATE TABLE "knowledge_source" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "KnowledgeSourceType" NOT NULL,
    "name" TEXT NOT NULL CHECK (char_length("name") BETWEEN 1 AND 200),
    "url" TEXT CHECK (char_length("url") <= 2000),
    "storageKey" TEXT,
    "status" "KnowledgeSourceStatus" NOT NULL DEFAULT 'QUEUED',
    "errorCode" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMP(3),
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_source_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "knowledge_source_projectId_createdAt_idx" ON "knowledge_source"("projectId", "createdAt");
CREATE INDEX "knowledge_source_status_availableAt_idx" ON "knowledge_source"("status", "availableAt");
ALTER TABLE "knowledge_source" ADD CONSTRAINT "knowledge_source_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_source" ADD CONSTRAINT "knowledge_source_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "knowledge_entry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceId" TEXT,
    "kind" "KnowledgeKind" NOT NULL,
    "title" TEXT NOT NULL CHECK (char_length("title") BETWEEN 1 AND 200),
    "content" TEXT NOT NULL CHECK (char_length("content") BETWEEN 1 AND 4000),
    -- Prix dans l'unité mineure de la devise du projet.
    "price" INTEGER CHECK ("price" BETWEEN 0 AND 2000000000),
    "stock" INTEGER CHECK ("stock" BETWEEN 0 AND 1000000000),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    -- Texte normalisé (minuscules, sans accents) : la recherche ne dépend d'aucune extension.
    "searchText" TEXT NOT NULL,
    "search" tsvector GENERATED ALWAYS AS (to_tsvector('french', "searchText")) STORED,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_entry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "knowledge_entry_search_idx" ON "knowledge_entry" USING GIN ("search");
CREATE INDEX "knowledge_entry_projectId_kind_createdAt_idx" ON "knowledge_entry"("projectId", "kind", "createdAt");
CREATE INDEX "knowledge_entry_sourceId_idx" ON "knowledge_entry"("sourceId");
ALTER TABLE "knowledge_entry" ADD CONSTRAINT "knowledge_entry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_entry" ADD CONSTRAINT "knowledge_entry_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_entry" ADD CONSTRAINT "knowledge_entry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
