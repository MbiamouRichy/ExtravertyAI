import type { PrismaClient, Prisma } from "../src/generated/prisma/client";
import {
  InternalNoteContentSchema,
  MAX_CONTACT_TAGS,
  MAX_PROJECT_TAGS,
  TagNameSchema,
  tagKey,
} from "./conversation-workflow-schema";
import { queueCsatSurvey } from "./csat";
import { emitIntegrationEvent, integrationContact } from "./integration-events";

// Message sûr à afficher tel quel ; toute autre erreur reste générique.
export class ConversationWorkflowError extends Error {}

type Actor = { projectId: string; contactId: string; userId: string };

// Même verrou que l'ingestion : un message client et une résolution ne se croisent pas.
async function lockProject(tx: Prisma.TransactionClient, projectId: string) {
  await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
}

// Tout membre du projet (quel que soit son rôle) peut organiser les conversations.
async function requireContact(
  db: Prisma.TransactionClient | PrismaClient,
  { projectId, contactId, userId }: Actor,
) {
  const contact = await db.contact.findFirst({
    where: {
      id: contactId,
      projectId,
      project: { deletionPending: false, members: { some: { userId } } },
    },
    select: { id: true },
  });
  if (!contact) {
    throw new ConversationWorkflowError("Conversation indisponible.");
  }
}

export async function setConversationResolved(
  db: PrismaClient,
  input: Actor & { resolved: boolean; seenMessageId?: string },
) {
  return db.$transaction(async (tx) => {
    await lockProject(tx, input.projectId);
    await requireContact(tx, input);

    if (input.resolved && input.seenMessageId) {
      const seen = await tx.message.findFirst({
        where: {
          id: input.seenMessageId,
          projectId: input.projectId,
          contactId: input.contactId,
        },
        select: { createdAt: true, id: true },
      });
      const newer = await tx.message.count({
        where: {
          projectId: input.projectId,
          contactId: input.contactId,
          senderType: "CLIENT",
          fromMe: false,
          ...(seen
            ? {
                OR: [
                  { createdAt: { gt: seen.createdAt } },
                  { createdAt: seen.createdAt, id: { gt: seen.id } },
                ],
              }
            : {}),
        },
      });
      if (!seen || newer > 0) {
        throw new ConversationWorkflowError(
          "Le client vient d’écrire. Lisez son message avant de résoudre.",
        );
      }
    }

    const resolvedAt = input.resolved ? new Date() : null;
    await tx.contact.update({
      where: { id: input.contactId },
      data: {
        resolvedAt,
        resolvedById: input.resolved ? input.userId : null,
      },
    });
    // Satisfaction survey: only when the project enabled it, at most weekly per contact.
    const surveySent = input.resolved
      ? await queueCsatSurvey(tx, {
          projectId: input.projectId,
          contactId: input.contactId,
          userId: input.userId,
        })
      : false;
    if (input.resolved) {
      const actor = await tx.user.findUnique({ where: { id: input.userId }, select: { name: true } });
      await emitIntegrationEvent(tx, input.projectId, "conversation.resolved", {
        contact: await integrationContact(tx, input.contactId),
        resolvedBy: firstName(actor?.name),
        surveySent,
      });
    }
    return { resolvedAt, surveySent };
  });
}

export async function addContactTag(
  db: PrismaClient,
  input: Actor & { name: string },
) {
  const parsed = TagNameSchema.safeParse(input.name);
  if (!parsed.success) {
    throw new ConversationWorkflowError(
      parsed.error.issues[0]?.message ?? "Étiquette invalide.",
    );
  }
  const name = parsed.data;
  const nameKey = tagKey(name);

  return db.$transaction(async (tx) => {
    // Le verrou rend la limite par projet fiable face aux ajouts simultanés.
    await lockProject(tx, input.projectId);
    await requireContact(tx, input);

    let tag = await tx.tag.findUnique({
      where: { projectId_nameKey: { projectId: input.projectId, nameKey } },
      select: { id: true, name: true },
    });
    if (!tag) {
      const total = await tx.tag.count({
        where: { projectId: input.projectId },
      });
      if (total >= MAX_PROJECT_TAGS) {
        throw new ConversationWorkflowError(
          `Limite de ${MAX_PROJECT_TAGS} étiquettes atteinte pour ce projet. Retirez-en une inutilisée.`,
        );
      }
      tag = await tx.tag.create({
        data: { projectId: input.projectId, name, nameKey },
        select: { id: true, name: true },
      });
    }

    const existing = await tx.contactTag.findUnique({
      where: { contactId_tagId: { contactId: input.contactId, tagId: tag.id } },
      select: { tagId: true },
    });
    if (!existing) {
      const onContact = await tx.contactTag.count({
        where: { contactId: input.contactId },
      });
      if (onContact >= MAX_CONTACT_TAGS) {
        throw new ConversationWorkflowError(
          `Un contact peut avoir ${MAX_CONTACT_TAGS} étiquettes au maximum.`,
        );
      }
      await tx.contactTag.create({
        data: { contactId: input.contactId, tagId: tag.id },
      });
    }
    return tag;
  });
}

export async function removeContactTag(
  db: PrismaClient,
  input: Actor & { tagId: string },
) {
  await db.$transaction(async (tx) => {
    await lockProject(tx, input.projectId);
    await requireContact(tx, input);
    await tx.contactTag.deleteMany({
      where: {
        contactId: input.contactId,
        tagId: input.tagId,
        tag: { projectId: input.projectId },
      },
    });
    // Une étiquette sans contact disparaît pour libérer la limite du projet.
    await tx.tag.deleteMany({
      where: {
        id: input.tagId,
        projectId: input.projectId,
        contacts: { none: {} },
      },
    });
  });
}

export async function createInternalNote(
  db: PrismaClient,
  input: Actor & { content: string },
) {
  const parsed = InternalNoteContentSchema.safeParse(input.content);
  if (!parsed.success) {
    throw new ConversationWorkflowError(
      parsed.error.issues[0]?.message ?? "Note invalide.",
    );
  }
  await requireContact(db, input);
  return db.internalNote.create({
    data: {
      projectId: input.projectId,
      contactId: input.contactId,
      authorId: input.userId,
      content: parsed.data,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: { id: true, name: true, image: true } },
    },
  });
}

function firstName(name: string | null | undefined): string {
  return (name?.trim().split(/\s+/)[0] || "un membre").slice(0, 80);
}

// Tout membre peut (ré)assigner : l'équipe se répartit le travail sans passer par un admin.
export async function assignConversation(
  db: PrismaClient,
  input: Actor & { assigneeId: string | null },
) {
  return db.$transaction(async (tx) => {
    await lockProject(tx, input.projectId);
    await requireContact(tx, input);

    const assignee = input.assigneeId
      ? (
          await tx.projectMembership.findUnique({
            where: {
              userId_projectId: {
                userId: input.assigneeId,
                projectId: input.projectId,
              },
            },
            select: { user: { select: { id: true, name: true, image: true } } },
          })
        )?.user
      : null;
    if (input.assigneeId && !assignee) {
      throw new ConversationWorkflowError(
        "Ce membre ne fait plus partie du projet.",
      );
    }

    const current = await tx.contact.findUniqueOrThrow({
      where: { id: input.contactId },
      select: { assigneeId: true },
    });
    if (current.assigneeId === (assignee?.id ?? null)) {
      return { assignee: assignee ?? null, changed: false };
    }

    await tx.contact.update({
      where: { id: input.contactId },
      data: assignee
        ? { assigneeId: assignee.id, assignedAt: new Date(), assignedById: input.userId }
        : { assigneeId: null, assignedAt: null, assignedById: null },
    });
    await tx.contactEvent.create({
      data: {
        projectId: input.projectId,
        contactId: input.contactId,
        actorId: input.userId,
        type: assignee ? "ASSIGNED" : "UNASSIGNED",
        // Sans détail : la personne s'est attribué la conversation elle-même.
        detail: assignee && assignee.id !== input.userId ? firstName(assignee.name) : null,
      },
    });
    await emitIntegrationEvent(tx, input.projectId, "conversation.assigned", {
      contact: await integrationContact(tx, input.contactId),
      assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
    });
    return { assignee: assignee ?? null, changed: true };
  });
}

export async function assignableMembers(
  db: PrismaClient,
  projectId: string,
  userId: string,
) {
  const members = await db.projectMembership.findMany({
    where: {
      projectId,
      project: { deletionPending: false, members: { some: { userId } } },
    },
    orderBy: [{ user: { name: "asc" } }, { userId: "asc" }],
    select: {
      role: true,
      user: { select: { id: true, name: true, image: true } },
    },
  });
  return members.map((member) => ({ ...member.user, role: member.role }));
}

export async function projectTags(db: PrismaClient, projectId: string) {
  const tags = await db.tag.findMany({
    where: { projectId },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, _count: { select: { contacts: true } } },
  });
  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    count: tag._count.contacts,
  }));
}
