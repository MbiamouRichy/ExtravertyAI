-- Résolution de conversation
ALTER TABLE "contact" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "contact" ADD COLUMN "resolvedById" TEXT;
ALTER TABLE "contact" ADD CONSTRAINT "contact_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "contact_projectId_resolvedAt_idx" ON "contact"("projectId", "resolvedAt");

-- Étiquettes
CREATE TABLE "tag" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL CHECK (char_length("name") BETWEEN 2 AND 24),
    "nameKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tag_projectId_nameKey_key" ON "tag"("projectId", "nameKey");
CREATE INDEX "tag_projectId_name_idx" ON "tag"("projectId", "name");
ALTER TABLE "tag" ADD CONSTRAINT "tag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "contact_tag" (
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_tag_pkey" PRIMARY KEY ("contactId", "tagId")
);
CREATE INDEX "contact_tag_tagId_idx" ON "contact_tag"("tagId");
ALTER TABLE "contact_tag" ADD CONSTRAINT "contact_tag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_tag" ADD CONSTRAINT "contact_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notes internes (jamais envoyées à WhatsApp ni aux contextes IA)
CREATE TABLE "internal_note" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "authorId" TEXT,
    "content" TEXT NOT NULL CHECK (char_length("content") BETWEEN 1 AND 2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "internal_note_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "internal_note_projectId_contactId_createdAt_id_idx" ON "internal_note"("projectId", "contactId", "createdAt", "id");
ALTER TABLE "internal_note" ADD CONSTRAINT "internal_note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_note" ADD CONSTRAINT "internal_note_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_note" ADD CONSTRAINT "internal_note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
