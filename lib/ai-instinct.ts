import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../src/generated/prisma/client";
import { assessProspect } from "./instinct-decision";
export { assessProspect } from "./instinct-decision";
// A database lease coordinates workers. No network request is held inside a transaction.
export async function runInstinctCycle(
  prisma: PrismaClient,
  assess = assessProspect,
) {
  const token = randomUUID();
  const [candidate] = await prisma.$queryRaw<
    Array<{
      id: string;
      projectId: string;
      sourceId: string;
      version: number;
      goals: string;
    }>
  >`
    WITH candidate AS (
      SELECT c.id, c."projectId", latest.id AS "sourceId", p."agentConfigVersion" AS version, p."agentSystemMessage" AS goals
      FROM contact c JOIN project p ON p.id = c."projectId"
      CROSS JOIN LATERAL (SELECT m.id FROM message m WHERE m."contactId" = c.id AND m."projectId" = p.id ORDER BY m."createdAt" DESC, m.id DESC LIMIT 1) latest
      WHERE NOT p."deletionPending" AND p."agentQualifyLeads" AND p."agentSetupCompletedAt" IS NOT NULL
        AND (p.status IN ('active', 'trialing') OR (p."automationPaused" AND p.status = 'paused' AND p."statusBeforePause" IN ('active', 'trialing')))
        AND EXISTS (SELECT 1 FROM quota_period q WHERE q."projectId" = p.id AND q."isCurrent"
          AND q.kind = CASE WHEN p."automationPaused" AND p.status = 'paused' THEN p."statusBeforePause" ELSE p.status END
          AND q."startsAt" <= clock_timestamp() AND q."endsAt" > clock_timestamp())
        AND length(trim(p."agentSystemMessage")) > 0
        AND (c."instinctLeaseUntil" IS NULL OR c."instinctLeaseUntil" < clock_timestamp())
        AND (c."instinctClassification" IS NULL OR c."instinctSourceId" IS DISTINCT FROM latest.id OR c."instinctConfigVersion" <> p."agentConfigVersion")
        AND EXISTS (SELECT 1 FROM message m WHERE m."contactId" = c.id AND m."projectId" = p.id AND m."senderType" = 'CLIENT' AND m.type = 'TEXT')
      ORDER BY c."instinctLeaseUntil" NULLS FIRST, c.id
      LIMIT 1 FOR UPDATE OF c SKIP LOCKED
    )
    UPDATE contact c SET "instinctLeaseToken" = ${token}, "instinctLeaseUntil" = clock_timestamp() + interval '2 minutes'
    FROM candidate a WHERE c.id = a.id RETURNING a.*`;
  if (!candidate) return null;
  try {
    const messages = await prisma.message.findMany({
      where: {
        projectId: candidate.projectId,
        contactId: candidate.id,
        type: "TEXT",
        OR: [
          { senderType: "CLIENT", fromMe: false },
          { status: { in: ["SENT", "DELIVERED", "READ"] } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 60,
      select: { senderType: true, content: true, type: true },
    });
    const classification = await assess(candidate.goals, messages.reverse());
    const saved = await prisma.contact.updateMany({
      where: {
        id: candidate.id,
        projectId: candidate.projectId,
        instinctLeaseToken: token,
        project: {
          deletionPending: false,
          agentConfigVersion: candidate.version,
          agentQualifyLeads: true,
        },
      },
      data: {
        instinctInteresting: classification === "interesting",
        instinctClassification: classification,
        instinctSourceId: candidate.sourceId,
        instinctConfigVersion: candidate.version,
        instinctLeaseToken: null,
        instinctLeaseUntil: null,
      },
    });
    return saved.count ? candidate.projectId : null;
  } catch {
    // Use the same database clock as lease acquisition, even if host clocks differ.
    await prisma.$executeRaw`UPDATE contact
      SET "instinctLeaseToken" = NULL, "instinctLeaseUntil" = clock_timestamp() + interval '5 minutes'
      WHERE id = ${candidate.id} AND "instinctLeaseToken" = ${token}`;
    console.error(
      "[ai-instinct] Analyse indisponible, nouvelle tentative différée.",
    );
    return null;
  }
}
