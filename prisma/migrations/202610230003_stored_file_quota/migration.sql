-- Fichiers déposés par l'équipe : base du quota de stockage par offre.
CREATE TABLE "stored_file" (
    "key" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_file_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "stored_file_projectId_idx" ON "stored_file"("projectId");

ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
