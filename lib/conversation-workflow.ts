import type { PrismaClient, Prisma } from "../src/generated/prisma/client";
import {
  InternalNoteContentSchema,
  MAX_CONTACT_TAGS,
  MAX_PROJECT_TAGS,
  TagNameSchema,
  tagKey,
} from "./conversation-workflow-schema";

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
    return { resolvedAt };
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
