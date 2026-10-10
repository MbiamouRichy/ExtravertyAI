import type { PrismaClient } from "../src/generated/prisma/client";

// Membership is checked in the same statement as the update, for every project role.
export async function writeContactAiState(
  db: PrismaClient,
  projectId: string,
  contactId: string,
  userId: string,
  enabled: boolean,
  expectedVersion?: number,
) {
  return db.$executeRaw`
    UPDATE contact c SET "aiActive" = ${enabled}, "aiVersion" = c."aiVersion" + 1, "updatedAt" = NOW()
    WHERE c.id = ${contactId} AND c."projectId" = ${projectId}
      AND (${expectedVersion ?? null}::int IS NULL OR c."aiVersion" = ${expectedVersion ?? null})
      AND EXISTS (
        SELECT 1 FROM project p
        JOIN project_membership pm ON pm."projectId" = p.id
        WHERE p.id = c."projectId" AND p."deletionPending" = false AND pm."userId" = ${userId}
      )
  `;
}
