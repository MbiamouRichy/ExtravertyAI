import type { PrismaClient } from "../src/generated/prisma/client";
import { rolesWith } from "./project-permissions";

// Membership is checked in the same statement as the update, for every project role.
// A real state change is journaled atomically so the conversation shows who
// paused or re-enabled the assistant; repeated clicks log nothing.
export async function writeContactAiState(
  db: PrismaClient,
  projectId: string,
  contactId: string,
  userId: string,
  enabled: boolean,
  expectedVersion?: number,
) {
  const eventType = enabled ? "AI_ENABLED" : "AI_PAUSED";
  const rows = await db.$queryRaw<Array<{ count: number }>>`
    WITH target AS (
      SELECT c.id, c."aiActive" AS was
      FROM contact c
      WHERE c.id = ${contactId} AND c."projectId" = ${projectId}
        AND (${expectedVersion ?? null}::int IS NULL OR c."aiVersion" = ${expectedVersion ?? null})
        AND EXISTS (
          SELECT 1 FROM project p
          JOIN project_membership pm ON pm."projectId" = p.id
          WHERE p.id = c."projectId" AND p."deletionPending" = false AND pm."userId" = ${userId}
            AND pm.role::text = ANY(${rolesWith("conversations.handle")}::text[])
        )
      FOR UPDATE OF c
    ), updated AS (
      UPDATE contact c SET "aiActive" = ${enabled}, "aiVersion" = c."aiVersion" + 1, "updatedAt" = NOW(),
        -- Re-enabling the assistant also ends its quiet mode.
        "aiQuietSince" = CASE WHEN ${enabled} THEN NULL ELSE c."aiQuietSince" END
      FROM target
      WHERE c.id = target.id
      RETURNING c.id, target.was
    ), logged AS (
      INSERT INTO contact_event (id, "projectId", "contactId", "actorId", type)
      SELECT gen_random_uuid()::text, ${projectId}, updated.id, ${userId}, ${eventType}::"ContactEventType"
      FROM updated
      WHERE updated.was IS DISTINCT FROM ${enabled}
    )
    SELECT count(*)::int AS count FROM updated
  `;
  return Number(rows[0]?.count ?? 0);
}
