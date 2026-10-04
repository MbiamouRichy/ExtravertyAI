CREATE TABLE "conversation_read_state" (
  "membershipId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "lastReadAt" TIMESTAMP(3) NOT NULL,
  "lastReadId" TEXT NOT NULL,
  CONSTRAINT "conversation_read_state_pkey" PRIMARY KEY ("membershipId", "contactId"),
  CONSTRAINT "conversation_read_state_membership_fkey" FOREIGN KEY ("membershipId") REFERENCES "project_membership"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "conversation_read_state_contact_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "conversation_read_state_contactId_idx" ON "conversation_read_state"("contactId");
