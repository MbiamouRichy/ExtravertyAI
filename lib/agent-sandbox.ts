import { z } from "zod";
import type { PrismaClient } from "../src/generated/prisma/client";
import { AgentConfigSchema } from "./agent-config";
import { generateReply } from "./ai-jobs";
import { findRepetition, repetitionHint, splitConversationEnd } from "./conversation-end";
import { knowledgeContext } from "./knowledge";
import { splitMissingInfo } from "./missing-info";
import { planFeatures } from "./plan-features";
import { requireProjectAdmin } from "./project-settings";

// Safe to show as is to the user.
export class SandboxError extends Error {}

export const SandboxMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1000),
});

export const SandboxInputSchema = z.object({
  projectId: z.string().cuid(),
  // The last message is the customer's new question.
  messages: z
    .array(SandboxMessageSchema)
    .min(1)
    .max(20)
    .refine((messages) => messages.at(-1)?.role === "user", "Le dernier message doit venir du client."),
});

export type SandboxTrace = {
  sources: Array<{ id: string; kind: string; title: string }>;
  settings: { tone: string; length: string; language: string; emojis: boolean };
  missingInfo: boolean;
  /**
   * What would happen in a real conversation: « end » closes it and puts the
   * assistant in quiet mode, « silent » and « repeated » send nothing.
   */
  ending: "none" | "end" | "silent" | "repeated";
};

const TONE: Record<string, string> = { warm: "Chaleureux", professional: "Professionnel", direct: "Direct" };
const LENGTH: Record<string, string> = { concise: "Concise", balanced: "Équilibrée", detailed: "Détaillée" };
const LANGUAGE: Record<string, string> = { auto: "Langue du client", fr: "Français", en: "Anglais" };

/**
 * Runs the exact production generation (same prompt, same knowledge retrieval)
 * without sending anything on WhatsApp and without consuming the message quota.
 */
export async function runAgentTest(
  db: PrismaClient,
  input: z.input<typeof SandboxInputSchema> & { userId: string },
  generate = generateReply,
) {
  const { projectId, messages } = SandboxInputSchema.parse(input);
  const { project, run, remaining } = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
    const { project } = await requireProjectAdmin(tx, projectId, input.userId);
    if (project.deletionPending) throw new SandboxError("Ce projet est en cours de suppression.");
    if (!project.agentSetupCompletedAt) {
      throw new SandboxError("Configurez d’abord votre agent dans les paramètres.");
    }
    const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
    const limit = planFeatures(project.plan).sandboxPerDay;
    const used = await tx.agentTestRun.count({
      where: { projectId, createdAt: { gt: new Date(now.getTime() - 86_400_000) } },
    });
    if (used >= limit) {
      throw new SandboxError(
        `Limite de ${limit} tests par jour atteinte pour votre offre. Réessayez demain.`,
      );
    }
    const run = await tx.agentTestRun.create({
      data: { projectId, actorId: input.userId },
      select: { id: true },
    });
    return { project, run, remaining: limit - used - 1 };
  });

  const config = AgentConfigSchema.parse(project);
  const knowledge = await knowledgeContext(
    db,
    projectId,
    project.currency,
    messages.filter((message) => message.role === "user").map((message) => message.content),
  );
  const extras = { knowledge: knowledge.block, flagMissing: true, quiet: project.aiQuietEnabled };
  // Same loop guard as in production, against the assistant's previous test replies.
  const previous = messages
    .filter((message) => message.role === "assistant")
    .map((message) => message.content)
    .reverse();
  const clientTexts = messages.filter((message) => message.role === "user").map((message) => message.content);
  const clientAsked =
    clientTexts.length > 1 &&
    !!findRepetition(clientTexts.at(-1) ?? "", clientTexts.slice(0, -1).reverse());
  let raw: string;
  let repeated = false;
  try {
    raw = await generate(messages, project.name, "Client test", config, extras);
    const first = splitConversationEnd(raw);
    const repetition = first.silent ? null : findRepetition(first.text, previous, { clientAsked });
    if (repetition) {
      raw = await generate(messages, project.name, "Client test", config, {
        ...extras,
        avoid: repetitionHint(repetition),
      });
      const second = splitConversationEnd(raw);
      repeated = !second.silent && !!findRepetition(second.text, previous, { clientAsked });
    }
  } catch (error) {
    // A failed generation does not count against the daily allowance.
    await db.agentTestRun.delete({ where: { id: run.id } }).catch(() => undefined);
    throw new SandboxError(
      error instanceof Error && error.message === "AI_CONFIG_MISSING"
        ? "L’IA n’est pas configurée sur ce serveur."
        : "L’assistant n’a pas pu répondre. Réessayez dans un instant.",
    );
  }
  const closing = splitConversationEnd(raw);
  const { text, missing } = closing.silent
    ? { text: "", missing: false }
    : splitMissingInfo(closing.text);
  if (missing) {
    await db.agentTestRun.update({ where: { id: run.id }, data: { missingInfo: true } });
  }
  const trace: SandboxTrace = {
    sources: knowledge.entries.map((entry) => ({ id: entry.id, kind: entry.kind, title: entry.title })),
    settings: {
      tone: TONE[config.agentTone] ?? config.agentTone,
      length: LENGTH[config.agentResponseLength] ?? config.agentResponseLength,
      language: LANGUAGE[config.agentLanguage] ?? config.agentLanguage,
      emojis: config.agentUseEmojis,
    },
    missingInfo: missing,
    ending: closing.silent ? "silent" : repeated ? "repeated" : closing.end ? "end" : "none",
  };
  return { reply: text, trace, remaining };
}

export async function sandboxUsage(db: PrismaClient, projectId: string, plan: string) {
  const used = await db.agentTestRun.count({
    where: { projectId, createdAt: { gt: new Date(Date.now() - 86_400_000) } },
  });
  const limit = planFeatures(plan).sandboxPerDay;
  return { used, limit, remaining: Math.max(0, limit - used) };
}
