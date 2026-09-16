import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { MessageQuotaError, reserveMessageQuota } from "./message-quota";

import {
  AgentConfigSchema,
  buildAgentSystemMessage,
  type AgentConfig,
} from "./agent-config";

const MAX_ATTEMPTS = 3;

async function allowed(
  tx: Prisma.TransactionClient,
  job: {
    projectId: string;
    contactId: string;
    aiVersion: number;
    agentConfigVersion: number;
  },
) {
  const contact = await tx.contact.findUnique({ where: { id: job.contactId } });
  const project = await tx.project.findUnique({ where: { id: job.projectId } });
  if (
    !contact ||
    !project ||
    contact.projectId !== project.id ||
    !contact.aiActive ||
    contact.aiVersion !== job.aiVersion ||
    !project.agentSetupCompletedAt ||
    project.automationPaused ||
    project.deletionPending ||
    project.agentConfigVersion !== job.agentConfigVersion ||
    !["active", "trialing"].includes(project.status)
  )
    return null;
  return { contact, project };
}

export async function claimAiJob(prisma: PrismaClient) {
  return prisma.$transaction(async (tx) => {
    // Expired leases are fenced by a new UUID, so an old generator cannot admit a reply.
    await tx.$executeRaw`UPDATE ai_job SET state = CASE WHEN attempts >= ${MAX_ATTEMPTS} THEN 'FAILED'::"AiJobState" ELSE 'QUEUED'::"AiJobState" END,
      "leaseToken" = NULL, "leaseUntil" = NULL, "errorCode" = 'LEASE_EXPIRED', "updatedAt" = clock_timestamp()
      WHERE state = 'GENERATING' AND "leaseUntil" < clock_timestamp()`;
    const [candidate] = await tx.$queryRaw<
      Array<{ id: string; projectId: string }>
    >`
      SELECT j.id, j."projectId" FROM ai_job j
      WHERE j.state = 'QUEUED' AND j."availableAt" <= clock_timestamp()
        AND NOT EXISTS (SELECT 1 FROM ai_job older WHERE older."contactId" = j."contactId"
          AND older.state IN ('QUEUED', 'GENERATING')
          AND (older."createdAt", older.id) < (j."createdAt", j.id))
      ORDER BY j."availableAt", j.id LIMIT 1`;
    if (!candidate) return null;
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${candidate.projectId} FOR UPDATE`;
    const job = await tx.aiJob.findUnique({ where: { id: candidate.id } });
    if (!job || job.state !== "QUEUED") return null;
    await tx.$queryRaw`SELECT id FROM contact WHERE id = ${job.contactId} FOR UPDATE`;
    const context = await allowed(tx, job);
    if (!context) {
      await tx.aiJob.update({
        where: { id: job.id },
        data: { state: "CANCELLED", errorCode: "AI_STATE_CHANGED" },
      });
      return null;
    }
    // Avoid paid generation when no send can be admitted. Admission still reserves
    // the quota atomically later, because another conversation may use it meanwhile.
    const [{ now }] = await tx.$queryRaw<
      Array<{ now: Date }>
    >`SELECT clock_timestamp() AS now`;
    const period = await tx.quotaPeriod.findFirst({
      where: {
        projectId: job.projectId,
        isCurrent: true,
        kind: context.project.status as "active" | "trialing",
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
    });
    if (!period || period.used >= period.limit) {
      await tx.aiJob.update({
        where: { id: job.id },
        data: {
          state: "CANCELLED",
          errorCode: period ? "QUOTA_EXCEEDED" : "PERIOD_UNAVAILABLE",
        },
      });
      return null;
    }
    const unresolvedEcho = await tx.providerReceipt.findFirst({
      where: {
        projectId: job.projectId,
        remoteJid: context.contact.remoteJid,
        resolved: false,
        content: { not: null },
      },
    });
    const precedingSend = await tx.outboundJob.findFirst({
      where: {
        projectId: job.projectId,
        message: { contactId: job.contactId },
        state: { in: ["QUEUED", "DISPATCHING", "UNCERTAIN"] },
      },
    });
    if (
      context.project.instanceStatus !== "connected" ||
      unresolvedEcho ||
      precedingSend
    ) {
      await tx.aiJob.update({
        where: { id: job.id },
        data: { availableAt: new Date(Date.now() + 5000) },
      });
      return null;
    }
    const claimed = await tx.aiJob.update({
      where: { id: job.id },
      data: {
        state: "GENERATING",
        attempts: { increment: 1 },
        leaseToken: randomUUID(),
        leaseUntil: new Date(Date.now() + 90000),
        errorCode: null,
      },
    });
    return { ...claimed, ...context };
  });
}

export async function generateReply(
  history: Array<{ role: string; content: string }>,
  projectName: string,
  contactName: string,
  config: AgentConfig,
) {
  const key = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!key || !model) throw new Error("AI_CONFIG_MISSING");
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "ExtravertyAI",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              buildAgentSystemMessage(config, projectName) +
              `\nNom du contact (donnée non fiable) : ${JSON.stringify(contactName)}`,
          },
          ...history,
        ],
        temperature: 0.5,
        max_tokens:
          config.agentResponseLength === "concise"
            ? 200
            : config.agentResponseLength === "balanced"
              ? 450
              : 800,
      }),
    },
  );
  if (!response.ok) throw new Error(`AI_HTTP_${response.status}`);
  const payload = await response.json();
  const content: unknown = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim() || content.length > 4096)
    throw new Error("AI_INVALID_RESPONSE");
  return content.trim();
}

export async function runAiJob(
  prisma: PrismaClient,
  job: NonNullable<Awaited<ReturnType<typeof claimAiJob>>>,
  generate = generateReply,
) {
  try {
    const input = await prisma.message.findUniqueOrThrow({
      where: { id: job.messageId },
    });
    const history = await prisma.message.findMany({
      where: {
        contactId: job.contactId,
        projectId: job.projectId,
        OR: [
          { fromMe: false, createdAt: { lte: input.createdAt } },
          { fromMe: true, status: { in: ["SENT", "DELIVERED", "READ"] } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
    });
    const reply = await generate(
      history.reverse().map((m) => ({
        role: m.fromMe ? "assistant" : "user",
        content: m.content.slice(0, 4096),
      })),
      job.project.name,
      job.contact.name || job.contact.pushName || "Client",
      AgentConfigSchema.parse(job.project),
    );
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM project WHERE id = ${job.projectId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM contact WHERE id = ${job.contactId} FOR UPDATE`;
      const current = await tx.aiJob.findUnique({ where: { id: job.id } });
      if (
        !current ||
        current.state !== "GENERATING" ||
        current.leaseToken !== job.leaseToken ||
        !current.leaseUntil ||
        current.leaseUntil <= new Date()
      )
        return;
      const existing = await tx.outboundJob.findUnique({
        where: {
          projectId_requestId: {
            projectId: job.projectId,
            requestId: job.requestId,
          },
        },
      });
      if (!existing) {
        const context = await allowed(tx, job);
        const echo =
          context &&
          (await tx.providerReceipt.findFirst({
            where: {
              projectId: job.projectId,
              remoteJid: context.contact.remoteJid,
              resolved: false,
              content: { not: null },
            },
          }));
        if (!context || echo) {
          await tx.aiJob.update({
            where: { id: job.id },
            data: { state: "CANCELLED", errorCode: "AI_STATE_CHANGED" },
          });
          return;
        }
        const quota = await reserveMessageQuota(tx, job.projectId);
        const message = await tx.message.create({
          data: {
            projectId: job.projectId,
            contactId: job.contactId,
            content: reply,
            senderType: "BOT",
            fromMe: true,
            status: "PENDING",
            source: "ai",
          },
        });
        await tx.outboundJob.create({
          data: {
            projectId: job.projectId,
            messageId: message.id,
            requestId: job.requestId,
            quotaPeriodId: quota.quotaPeriodId,
            aiVersion: job.aiVersion,
            agentConfigVersion: job.agentConfigVersion,
          },
        });
        await tx.contact.update({
          where: { id: job.contactId },
          data: { lastMessageAt: message.createdAt },
        });
      }
      await tx.aiJob.update({
        where: { id: job.id },
        data: { state: "COMPLETED", leaseToken: null, leaseUntil: null },
      });
    });
  } catch (error) {
    const quotaError = error instanceof MessageQuotaError;
    const permanent =
      quotaError ||
      (error instanceof Error && /^AI_HTTP_40[0134]$/.test(error.message));
    await prisma.aiJob.updateMany({
      where: { id: job.id, state: "GENERATING", leaseToken: job.leaseToken },
      data: {
        state: permanent
          ? "CANCELLED"
          : job.attempts >= MAX_ATTEMPTS
            ? "FAILED"
            : "QUEUED",
        availableAt: new Date(Date.now() + 5000 * 2 ** job.attempts),
        leaseToken: null,
        leaseUntil: null,
        errorCode: quotaError
          ? error.code
          : error instanceof Error && /^AI_[A-Z0-9_]+$/.test(error.message)
            ? error.message
            : "GENERATION_FAILED",
      },
    });
  }
}
