import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { MessageQuotaError, reserveMessageQuota } from "./message-quota";
import { planAllows, requirePlanFeature } from "./plan-features";
import { requireProjectAdmin } from "./project-settings";
import { projectBillingStatus } from "./project-status";

/** A customer has 24 h to answer; a contact is surveyed at most once a week. */
export const CSAT_ANSWER_WINDOW_MS = 24 * 3_600_000;
export const CSAT_COOLDOWN_MS = 7 * 86_400_000;

export const CsatMessageSchema = z
  .string()
  .trim()
  .min(10, "Au moins 10 caractères.")
  .max(500, "500 caractères au maximum.");

/**
 * « 4 », « 4/5 », « 4 sur 5 », « note : 4 », « 4️⃣ » or « ⭐⭐⭐⭐ ».
 * Anything else is an ordinary message and follows the normal path.
 */
export function parseCsatScore(text: string): number | null {
  const value = text.trim();
  if (!value || value.length > 40) return null;
  const keycap = value.match(/^([1-5])️?⃣$/u);
  if (keycap) return Number(keycap[1]);
  const digit = value.match(
    /^(?:note\s*:?\s*)?([1-5])\s*(?:\/\s*5|sur\s*5|[ée]toiles?)?\s*[.!]*$/iu,
  );
  if (digit) return Number(digit[1]);
  const stars = value.replace(/️/gu, "").replace(/\s+/g, "");
  if (/^[⭐★]{1,5}$/u.test(stars)) return [...stars].length;
  return null;
}

/**
 * Queued in the resolving transaction (project and contact already locked).
 * Returns false whenever a survey must not be sent; never throws for that.
 */
export async function queueCsatSurvey(
  tx: Prisma.TransactionClient,
  input: { projectId: string; contactId: string; userId: string },
): Promise<boolean> {
  const project = await tx.project.findUniqueOrThrow({ where: { id: input.projectId } });
  if (
    !project.csatEnabled ||
    !planAllows(project.plan, "csat") ||
    project.deletionPending ||
    project.instanceStatus !== "connected" ||
    !["active", "trialing"].includes(projectBillingStatus(project))
  ) {
    return false;
  }
  const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
  const [clientMessage, recent] = await Promise.all([
    tx.message.findFirst({
      where: { projectId: input.projectId, contactId: input.contactId, senderType: "CLIENT" },
      select: { id: true },
    }),
    tx.csatSurvey.findFirst({
      where: { contactId: input.contactId, sentAt: { gt: new Date(now.getTime() - CSAT_COOLDOWN_MS) } },
      select: { id: true },
    }),
  ]);
  if (!clientMessage || recent) return false;

  let quota: Awaited<ReturnType<typeof reserveMessageQuota>>;
  try {
    quota = await reserveMessageQuota(tx, input.projectId);
  } catch (error) {
    // No quota left: the conversation is still resolved, just without survey.
    if (error instanceof MessageQuotaError) return false;
    throw error;
  }
  const contact = await tx.contact.findUniqueOrThrow({
    where: { id: input.contactId },
    select: { aiVersion: true },
  });
  const message = await tx.message.create({
    data: {
      projectId: input.projectId,
      contactId: input.contactId,
      content: project.csatMessage,
      senderType: "AGENT",
      agentId: input.userId,
      fromMe: true,
      status: "PENDING",
      source: "csat",
    },
  });
  await tx.outboundJob.create({
    data: {
      projectId: input.projectId,
      messageId: message.id,
      requestId: randomUUID(),
      quotaPeriodId: quota.quotaPeriodId,
      aiVersion: contact.aiVersion,
      agentConfigVersion: project.agentConfigVersion,
    },
  });
  await tx.csatSurvey.create({
    data: {
      projectId: input.projectId,
      contactId: input.contactId,
      messageId: message.id,
      resolvedById: input.userId,
      sentAt: now,
      expiresAt: new Date(now.getTime() + CSAT_ANSWER_WINDOW_MS),
    },
  });
  return true;
}

/** Open survey awaiting an answer from this contact, if any. */
export async function openCsatSurvey(tx: Prisma.TransactionClient, contactId: string) {
  return tx.csatSurvey.findFirst({
    where: { contactId, respondedAt: null, expiresAt: { gt: new Date() } },
    orderBy: [{ sentAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
}

export async function setCsatSettings(
  db: PrismaClient,
  input: { projectId: string; userId: string; enabled: boolean; message: string },
) {
  const message = CsatMessageSchema.parse(input.message);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${input.projectId} FOR UPDATE`;
    const { project } = await requireProjectAdmin(tx, input.projectId, input.userId);
    requirePlanFeature(project.plan, "csat");
    await tx.project.update({
      where: { id: input.projectId },
      data: { csatEnabled: input.enabled, csatMessage: message },
    });
    await tx.settingsAudit.create({
      data: {
        projectId: input.projectId,
        actorId: input.userId,
        action: input.enabled ? "csat.enabled" : "csat.disabled",
        version: project.settingsVersion,
      },
    });
  });
}

export async function csatStats(db: PrismaClient, projectId: string, since: Date) {
  const rows = await db.csatSurvey.groupBy({
    by: ["score"],
    where: { projectId, sentAt: { gte: since } },
    _count: { _all: true },
  });
  const sent = rows.reduce((sum, row) => sum + row._count._all, 0);
  const distribution = [1, 2, 3, 4, 5].map(
    (score) => rows.find((row) => row.score === score)?._count._all ?? 0,
  );
  const responses = distribution.reduce((sum, count) => sum + count, 0);
  const average = responses
    ? distribution.reduce((sum, count, index) => sum + count * (index + 1), 0) / responses
    : null;
  return { sent, responses, average, distribution };
}
