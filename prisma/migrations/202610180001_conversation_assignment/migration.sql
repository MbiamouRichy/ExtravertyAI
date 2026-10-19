-- Assignation manuelle d'une conversation à un membre du projet
ALTER TABLE "contact" ADD COLUMN "assigneeId" TEXT;
ALTER TABLE "contact" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "contact" ADD COLUMN "assignedById" TEXT;
ALTER TABLE "contact" ADD CONSTRAINT "contact_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contact" ADD CONSTRAINT "contact_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "contact_projectId_assigneeId_idx" ON "contact"("projectId", "assigneeId");

-- Journal : « X a assigné la conversation à Y ». Le prénom est figé au moment de l'action.
ALTER TYPE "ContactEventType" ADD VALUE 'ASSIGNED';
ALTER TYPE "ContactEventType" ADD VALUE 'UNASSIGNED';
ALTER TABLE "contact_event" ADD COLUMN "detail" TEXT CHECK (char_length("detail") <= 80);
