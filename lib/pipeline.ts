import type { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { chatContactName } from "./chat-privacy";
import { requirePlanFeature } from "./plan-features";
import { requireProjectAdmin } from "./project-settings";
import {
  CURRENCIES,
  MAX_DEAL_VALUE,
  PIPELINE_STAGES,
  PipelineError,
  stageLabel,
  type PipelineColumn,
  type PipelineStageId,
} from "./pipeline-shared";

export * from "./pipeline-shared";

type Actor = { projectId: string; contactId: string; userId: string };

async function requirePipelineContact(tx: Prisma.TransactionClient, input: Actor) {
  await tx.$queryRaw`SELECT id FROM project WHERE id = ${input.projectId} FOR UPDATE`;
  const contact = await tx.contact.findFirst({
    where: {
      id: input.contactId,
      projectId: input.projectId,
      project: { deletionPending: false, members: { some: { userId: input.userId } } },
    },
    select: { id: true, pipelineStage: true, project: { select: { plan: true } } },
  });
  if (!contact) throw new PipelineError("Conversation indisponible.");
  requirePlanFeature(contact.project.plan, "pipeline");
  return contact;
}

// Tout membre du projet peut faire avancer un prospect.
export async function movePipelineStage(
  db: PrismaClient,
  input: Actor & { stage: PipelineStageId },
) {
  return db.$transaction(async (tx) => {
    const contact = await requirePipelineContact(tx, input);
    if (contact.pipelineStage === input.stage) return { changed: false };
    await tx.contact.update({
      where: { id: input.contactId },
      data: {
        pipelineStage: input.stage,
        stageChangedAt: new Date(),
        stageChangedById: input.userId,
      },
    });
    await tx.contactEvent.create({
      data: {
        projectId: input.projectId,
        contactId: input.contactId,
        actorId: input.userId,
        type: "STAGE_CHANGED",
        detail: stageLabel(input.stage),
      },
    });
    return { changed: true, from: contact.pipelineStage as PipelineStageId };
  });
}

export async function setDealValue(
  db: PrismaClient,
  input: Actor & { value: number | null },
) {
  if (input.value !== null && (!Number.isSafeInteger(input.value) || input.value < 0 || input.value > MAX_DEAL_VALUE)) {
    throw new PipelineError("Montant invalide.");
  }
  await db.$transaction(async (tx) => {
    await requirePipelineContact(tx, input);
    await tx.contact.update({
      where: { id: input.contactId },
      data: { dealValue: input.value },
    });
  });
}

export async function setProjectCurrency(
  db: PrismaClient,
  input: { projectId: string; userId: string; currency: (typeof CURRENCIES)[number] },
) {
  await db.$transaction(async (tx) => {
    const { project } = await requireProjectAdmin(tx, input.projectId, input.userId);
    requirePlanFeature(project.plan, "pipeline");
    await tx.project.update({
      where: { id: input.projectId },
      data: { currency: input.currency },
    });
  });
}

/**
 * Instinct IA only moves a prospect forward out of « Nouveau », and never
 * once a member has positioned it by hand.
 */
export async function promoteInterestingProspect(
  tx: Prisma.TransactionClient,
  projectId: string,
  contactId: string,
) {
  const result = await tx.contact.updateMany({
    where: { id: contactId, projectId, pipelineStage: "NEW", stageChangedById: null },
    data: { pipelineStage: "INTERESTED", stageChangedAt: new Date() },
  });
  return result.count > 0;
}

const CARDS_PER_STAGE = 50;

export async function pipelineBoard(
  db: PrismaClient,
  projectId: string,
  userId: string,
): Promise<{ currency: string; columns: PipelineColumn[] } | null> {
  const project = await db.project.findFirst({
    where: { id: projectId, deletionPending: false, members: { some: { userId } } },
    select: { currency: true },
  });
  if (!project) return null;
  const [totals, ...cardsByStage] = await Promise.all([
    db.contact.groupBy({
      by: ["pipelineStage"],
      where: { projectId },
      _count: { _all: true },
      _sum: { dealValue: true },
    }),
    ...PIPELINE_STAGES.map((stage) =>
      db.contact.findMany({
        where: { projectId, pipelineStage: stage.id },
        orderBy: [
          { stageChangedAt: { sort: "desc", nulls: "last" } },
          { lastMessageAt: { sort: "desc", nulls: "last" } },
          { id: "asc" },
        ],
        take: CARDS_PER_STAGE,
        select: {
          id: true,
          name: true,
          pushName: true,
          dealValue: true,
          stageChangedAt: true,
          lastMessageAt: true,
          createdAt: true,
          instinctClassification: true,
          assignee: { select: { id: true, name: true, image: true } },
        },
      }),
    ),
  ]);
  return {
    currency: project.currency,
    columns: PIPELINE_STAGES.map((stage, index) => {
      const total = totals.find((row) => row.pipelineStage === stage.id);
      return {
        ...stage,
        count: total?._count._all ?? 0,
        total: total?._sum.dealValue ?? 0,
        cards: cardsByStage[index].map((contact) => ({
          id: contact.id,
          name: chatContactName(contact),
          dealValue: contact.dealValue,
          stageChangedAt: contact.stageChangedAt?.toISOString() ?? null,
          lastActivityAt: (contact.lastMessageAt ?? contact.createdAt).toISOString(),
          assignee: contact.assignee,
          interesting: contact.instinctClassification === "interesting",
        })),
      };
    }),
  };
}

/** Value won over a period, for the analytics card. */
export async function wonValue(
  db: PrismaClient,
  projectId: string,
  since: Date,
): Promise<{ total: number; deals: number }> {
  const rows = await db.contact.aggregate({
    where: { projectId, pipelineStage: "WON", stageChangedAt: { gte: since } },
    _sum: { dealValue: true },
    _count: { _all: true },
  });
  return { total: rows._sum.dealValue ?? 0, deals: rows._count._all };
}

/** Current value of open deals (Nouveau, Intéressé, Devis envoyé). */
export async function openPipelineValue(
  db: PrismaClient,
  projectId: string,
): Promise<{ total: number; count: number }> {
  const rows = await db.contact.aggregate({
    where: { projectId, pipelineStage: { in: ["NEW", "INTERESTED", "QUOTE_SENT"] }, dealValue: { not: null } },
    _sum: { dealValue: true },
    _count: { _all: true },
  });
  return { total: rows._sum.dealValue ?? 0, count: rows._count._all };
}
