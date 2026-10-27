import { z } from "zod";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { chatContactName } from "./chat-privacy";
import { KNOWLEDGE_LIMITS, entrySearchText } from "./knowledge-shared";
import { planFeatures } from "./plan-features";
import { requireProjectAdmin } from "./project-settings";
import { rolesWith } from "./project-permissions";

// Safe to show as is to the user.
export class FeedbackError extends Error {}

export const CorrectionSchema = z
  .string()
  .trim()
  .min(3, "Proposez une réponse d’au moins 3 caractères.")
  .max(KNOWLEDGE_LIMITS.contentMax, `${KNOWLEDGE_LIMITS.contentMax} caractères au maximum.`);

export const FaqDraftSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, "Au moins 3 caractères.")
    .max(KNOWLEDGE_LIMITS.titleMax, `${KNOWLEDGE_LIMITS.titleMax} caractères au maximum.`),
  answer: CorrectionSchema,
});

// Tout membre peut noter une réponse de l'IA : le retour vient du terrain.
export async function rateAiMessage(
  db: PrismaClient,
  input: {
    projectId: string;
    userId: string;
    messageId: string;
    rating: "UP" | "DOWN";
    correction?: string | null;
  },
) {
  const correction =
    input.rating === "DOWN" && input.correction ? CorrectionSchema.parse(input.correction) : null;
  const message = await db.message.findFirst({
    where: {
      id: input.messageId,
      projectId: input.projectId,
      senderType: "BOT",
      project: {
        deletionPending: false,
        members: { some: { userId: input.userId, role: { in: rolesWith("conversations.handle") } } },
      },
    },
    select: { id: true },
  });
  if (!message) throw new FeedbackError("Réponse introuvable.");
  return db.aiFeedback.upsert({
    where: { messageId_authorId: { messageId: message.id, authorId: input.userId } },
    create: {
      projectId: input.projectId,
      messageId: message.id,
      authorId: input.userId,
      rating: input.rating,
      correction,
    },
    // A new rating reopens the review of a previously handled correction.
    update: { rating: input.rating, correction, reviewedAt: null, entryId: null },
    select: { rating: true, correction: true },
  });
}

async function lockAdmin(tx: Prisma.TransactionClient, projectId: string, userId: string) {
  await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
  const { project } = await requireProjectAdmin(tx, projectId, userId);
  if (project.deletionPending) throw new FeedbackError("Ce projet est en cours de suppression.");
  return project;
}

async function createFaq(
  tx: Prisma.TransactionClient,
  project: { id: string; plan: string },
  userId: string,
  draft: z.infer<typeof FaqDraftSchema>,
) {
  const used = await tx.knowledgeEntry.count({ where: { projectId: project.id } });
  if (used >= planFeatures(project.plan).knowledgeEntries) {
    throw new FeedbackError("La base de connaissances est pleine pour votre offre.");
  }
  return tx.knowledgeEntry.create({
    data: {
      projectId: project.id,
      kind: "FAQ",
      title: draft.question,
      content: draft.answer,
      searchText: entrySearchText({ title: draft.question, content: draft.answer }),
      createdById: userId,
    },
    select: { id: true },
  });
}

/** Turns a missing-information question into a knowledge entry. */
export async function answerGap(
  db: PrismaClient,
  input: { projectId: string; userId: string; gapId: string; draft: z.input<typeof FaqDraftSchema> },
) {
  const draft = FaqDraftSchema.parse(input.draft);
  return db.$transaction(async (tx) => {
    const project = await lockAdmin(tx, input.projectId, input.userId);
    const gap = await tx.knowledgeGap.findFirst({
      where: { id: input.gapId, projectId: input.projectId, status: "OPEN" },
      select: { id: true },
    });
    if (!gap) throw new FeedbackError("Cette question a déjà été traitée.");
    const entry = await createFaq(tx, project, input.userId, draft);
    await tx.knowledgeGap.update({
      where: { id: gap.id },
      data: { status: "ANSWERED", entryId: entry.id, resolvedById: input.userId, resolvedAt: new Date() },
    });
    return entry;
  });
}

export async function dismissGap(
  db: PrismaClient,
  input: { projectId: string; userId: string; gapId: string },
) {
  await db.$transaction(async (tx) => {
    await lockAdmin(tx, input.projectId, input.userId);
    const result = await tx.knowledgeGap.updateMany({
      where: { id: input.gapId, projectId: input.projectId, status: "OPEN" },
      data: { status: "DISMISSED", resolvedById: input.userId, resolvedAt: new Date() },
    });
    if (!result.count) throw new FeedbackError("Cette question a déjà été traitée.");
  });
}

/** Turns a member's correction into a knowledge entry. */
export async function promoteCorrection(
  db: PrismaClient,
  input: { projectId: string; userId: string; feedbackId: string; draft: z.input<typeof FaqDraftSchema> },
) {
  const draft = FaqDraftSchema.parse(input.draft);
  return db.$transaction(async (tx) => {
    const project = await lockAdmin(tx, input.projectId, input.userId);
    const feedback = await tx.aiFeedback.findFirst({
      where: { id: input.feedbackId, projectId: input.projectId, reviewedAt: null, correction: { not: null } },
      select: { id: true },
    });
    if (!feedback) throw new FeedbackError("Cette correction a déjà été traitée.");
    const entry = await createFaq(tx, project, input.userId, draft);
    await tx.aiFeedback.update({
      where: { id: feedback.id },
      data: { entryId: entry.id, reviewedAt: new Date() },
    });
    return entry;
  });
}

export async function dismissCorrection(
  db: PrismaClient,
  input: { projectId: string; userId: string; feedbackId: string },
) {
  await db.$transaction(async (tx) => {
    await lockAdmin(tx, input.projectId, input.userId);
    const result = await tx.aiFeedback.updateMany({
      where: { id: input.feedbackId, projectId: input.projectId, reviewedAt: null },
      data: { reviewedAt: new Date() },
    });
    if (!result.count) throw new FeedbackError("Cette correction a déjà été traitée.");
  });
}

/** « À améliorer » tab: open gaps, pending corrections and the satisfaction ratio. */
export async function improvementOverview(db: PrismaClient, projectId: string) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [gaps, corrections, ratings] = await Promise.all([
    db.knowledgeGap.findMany({
      where: { projectId, status: "OPEN" },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 100,
      select: {
        id: true,
        question: true,
        createdAt: true,
        contact: { select: { id: true, name: true, pushName: true } },
      },
    }),
    db.aiFeedback.findMany({
      where: { projectId, reviewedAt: null, correction: { not: null } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 100,
      select: {
        id: true,
        correction: true,
        updatedAt: true,
        author: { select: { name: true } },
        message: {
          select: {
            content: true,
            createdAt: true,
            contactId: true,
            contact: { select: { name: true, pushName: true } },
          },
        },
      },
    }),
    db.aiFeedback.groupBy({
      by: ["rating"],
      where: { projectId, updatedAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  // The customer question each corrected answer replied to.
  const questions = await Promise.all(
    corrections.map((item) =>
      db.message.findFirst({
        where: {
          projectId,
          contactId: item.message.contactId,
          senderType: "CLIENT",
          createdAt: { lte: item.message.createdAt },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { content: true },
      }),
    ),
  );
  const count = (rating: "UP" | "DOWN") =>
    ratings.find((row) => row.rating === rating)?._count._all ?? 0;
  return {
    ratings: { up: count("UP"), down: count("DOWN") },
    gaps: gaps.map((gap) => ({
      id: gap.id,
      question: gap.question,
      createdAt: gap.createdAt.toISOString(),
      contactId: gap.contact?.id ?? null,
      contactName: gap.contact ? chatContactName(gap.contact) : null,
    })),
    corrections: corrections.map((item, index) => ({
      id: item.id,
      correction: item.correction ?? "",
      original: item.message.content,
      question: questions[index]?.content.slice(0, KNOWLEDGE_LIMITS.titleMax) ?? "",
      author: item.author.name,
      contactName: chatContactName(item.message.contact),
      updatedAt: item.updatedAt.toISOString(),
    })),
  };
}
