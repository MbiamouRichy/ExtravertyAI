import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { MessageQuotaError, reserveMessageQuota } from "./message-quota";
import { can } from "./project-permissions";
import { projectBillingStatus } from "./project-status";
import {
  SCHEDULED_MESSAGE_LIMITS as LIMITS,
  SCHEDULED_SOURCE,
  ScheduledContentSchema,
  scheduleTimeError,
  type ScheduledChatMessage,
  type ScheduledFailureReason,
} from "./scheduled-messages-shared";

export * from "./scheduled-messages-shared";

/** Refus sûr à afficher tel quel à l'utilisateur. */
export class ScheduledMessageError extends Error {}

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

function parseContent(value: string) {
  const parsed = ScheduledContentSchema.safeParse(value);
  if (!parsed.success) {
    throw new ScheduledMessageError(parsed.error.issues[0]?.message ?? "Message invalide.");
  }
  return parsed.data;
}

/** Membres qui répondent aux clients : les mêmes que pour un envoi immédiat. */
async function requireHandler(db: Db, projectId: string, userId: string) {
  const membership = await db.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: {
      role: true,
      project: {
        select: { deletionPending: true, status: true, automationPaused: true, statusBeforePause: true },
      },
    },
  });
  // Même réponse pour « pas membre » et « rôle insuffisant » : rien ne fuit.
  if (!membership || !can(membership.role, "conversations.handle")) {
    throw new ScheduledMessageError("Accès refusé.");
  }
  if (membership.project.deletionPending) {
    throw new ScheduledMessageError("Ce projet est en cours de suppression.");
  }
  return membership;
}

function requireActive(project: { status: string; automationPaused: boolean; statusBeforePause: string | null }) {
  if (!["active", "trialing"].includes(projectBillingStatus(project))) {
    throw new ScheduledMessageError("Le projet n’est pas actif.");
  }
}

/** Verrou du projet et horloge de la base, celle qui juge « passé » ou « à venir ». */
async function lockProject(tx: Tx, projectId: string) {
  const [locked] = await tx.$queryRaw<Array<{ now: Date }>>`
    SELECT clock_timestamp() AS now FROM project WHERE id = ${projectId} FOR UPDATE`;
  if (!locked) throw new ScheduledMessageError("Projet indisponible.");
  return locked.now;
}

async function requireRoom(tx: Tx, projectId: string, contactId: string) {
  const [perContact, perProject] = await Promise.all([
    tx.scheduledMessage.count({ where: { projectId, contactId, status: "SCHEDULED" } }),
    tx.scheduledMessage.count({ where: { projectId, status: "SCHEDULED" } }),
  ]);
  if (perContact >= LIMITS.perContact) {
    throw new ScheduledMessageError(
      `${LIMITS.perContact} messages programmés au plus par conversation. Annulez-en un pour en ajouter un autre.`,
    );
  }
  if (perProject >= LIMITS.perProject) {
    throw new ScheduledMessageError(
      `${LIMITS.perProject} messages programmés au plus par projet. Annulez-en pour en ajouter d’autres.`,
    );
  }
}

/** Verrou d'un message programmé de ce projet (même ordre que l'envoi : message, projet, contact). */
async function lockScheduled(tx: Tx, projectId: string, id: string) {
  const [row] = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM scheduled_message WHERE id = ${id} AND "projectId" = ${projectId} FOR UPDATE`;
  if (!row) throw new ScheduledMessageError("Message programmé introuvable.");
  const item = await tx.scheduledMessage.findUniqueOrThrow({ where: { id: row.id } });
  if (item.status === "FAILED" && item.dismissedAt) {
    throw new ScheduledMessageError("Message programmé introuvable.");
  }
  return item;
}

function closedError(status: string) {
  if (status === "SENT") return new ScheduledMessageError("Ce message est déjà parti.");
  if (status === "CANCELLED") return new ScheduledMessageError("Ce message programmé a été annulé.");
  return new ScheduledMessageError("Ce message n’a pas pu partir : reprogrammez-le ou retirez-le.");
}

/* -------------------------------------------------------------------------- */
/* Actions de l'équipe                                                         */
/* -------------------------------------------------------------------------- */

export type ScheduleInput = {
  projectId: string;
  contactId: string;
  userId: string;
  /** Identifiant de la demande : un nouvel essai ne programme pas deux fois. */
  requestId: string;
  content: string;
  scheduledAt: Date;
};

export async function scheduleMessage(db: PrismaClient, input: ScheduleInput) {
  const content = parseContent(input.content);
  return db.$transaction(async (tx) => {
    // Verrou du projet : limites comptées sans course entre deux membres.
    const now = await lockProject(tx, input.projectId);
    const { project } = await requireHandler(tx, input.projectId, input.userId);
    requireActive(project);

    const existing = await tx.scheduledMessage.findUnique({
      where: { projectId_requestId: { projectId: input.projectId, requestId: input.requestId } },
    });
    if (existing) {
      if (
        existing.authorId !== input.userId ||
        existing.contactId !== input.contactId ||
        existing.content !== content ||
        existing.scheduledAt.getTime() !== input.scheduledAt.getTime()
      ) {
        throw new ScheduledMessageError("Cet identifiant de demande a déjà été utilisé.");
      }
      return existing;
    }

    const contact = await tx.contact.findFirst({
      where: { id: input.contactId, projectId: input.projectId },
      select: { id: true },
    });
    if (!contact) throw new ScheduledMessageError("Contact indisponible.");

    const timeError = scheduleTimeError(input.scheduledAt, now);
    if (timeError) throw new ScheduledMessageError(timeError);
    await requireRoom(tx, input.projectId, input.contactId);

    return tx.scheduledMessage.create({
      data: {
        projectId: input.projectId,
        contactId: input.contactId,
        authorId: input.userId,
        requestId: input.requestId,
        content,
        scheduledAt: input.scheduledAt,
        nextAttemptAt: input.scheduledAt,
      },
    });
  });
}

export type UpdateScheduledInput = {
  projectId: string;
  userId: string;
  scheduledMessageId: string;
  /** Version lue par l'auteur : une modification concurrente n'est pas écrasée. */
  version: number;
  content: string;
  scheduledAt: Date;
};

/**
 * Seul l'auteur modifie son message : il part en son nom. Un message en échec
 * (non retiré) se reprogramme de la même façon.
 */
export async function updateScheduledMessage(db: PrismaClient, input: UpdateScheduledInput) {
  const content = parseContent(input.content);
  return db.$transaction(async (tx) => {
    const { project } = await requireHandler(tx, input.projectId, input.userId);
    const item = await lockScheduled(tx, input.projectId, input.scheduledMessageId);
    if (item.authorId !== input.userId) {
      throw new ScheduledMessageError("Seul son auteur peut modifier ce message programmé.");
    }
    if (item.status !== "SCHEDULED" && item.status !== "FAILED") throw closedError(item.status);
    if (item.version !== input.version) {
      throw new ScheduledMessageError(
        "Ce message a été modifié entre-temps : vérifiez sa dernière version avant de l’enregistrer.",
      );
    }
    const now = await lockProject(tx, input.projectId);
    requireActive(project);
    const timeError = scheduleTimeError(input.scheduledAt, now);
    if (timeError) throw new ScheduledMessageError(timeError);
    if (item.status === "FAILED") await requireRoom(tx, input.projectId, item.contactId);

    return tx.scheduledMessage.update({
      where: { id: item.id },
      data: {
        content,
        scheduledAt: input.scheduledAt,
        nextAttemptAt: input.scheduledAt,
        status: "SCHEDULED",
        failureReason: null,
        failedAt: null,
        version: { increment: 1 },
      },
    });
  });
}

type TargetInput = { projectId: string; userId: string; scheduledMessageId: string };

/**
 * L'auteur, ou un responsable de l'équipe (propriétaire, administrateur,
 * superviseur) : annuler n'envoie rien au nom de personne.
 */
async function requireCanceller(tx: Tx, input: TargetInput) {
  const membership = await requireHandler(tx, input.projectId, input.userId);
  const item = await lockScheduled(tx, input.projectId, input.scheduledMessageId);
  const isAuthor = item.authorId === input.userId;
  if (!isAuthor && !can(membership.role, "conversations.dispatch")) {
    throw new ScheduledMessageError(
      "Seuls son auteur et les responsables de l’équipe peuvent annuler ce message.",
    );
  }
  return { item, isAuthor };
}

export async function cancelScheduledMessage(db: PrismaClient, input: TargetInput) {
  return db.$transaction(async (tx) => {
    const { item, isAuthor } = await requireCanceller(tx, input);
    if (item.status !== "SCHEDULED") throw closedError(item.status);
    const updated = await tx.scheduledMessage.update({
      where: { id: item.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: input.userId,
        failureReason: null,
        version: { increment: 1 },
      },
    });
    // L'auteur retrouve dans la conversation qui a annulé son message.
    if (!isAuthor) {
      await tx.contactEvent.create({
        data: {
          projectId: item.projectId,
          contactId: item.contactId,
          actorId: input.userId,
          type: "SCHEDULED_MESSAGE_CANCELLED",
        },
      });
    }
    return updated;
  });
}

/** Retire de la conversation un message programmé en échec. */
export async function dismissScheduledMessage(db: PrismaClient, input: TargetInput) {
  return db.$transaction(async (tx) => {
    const { item } = await requireCanceller(tx, input);
    if (item.status !== "FAILED") throw closedError(item.status);
    return tx.scheduledMessage.update({
      where: { id: item.id },
      data: { dismissedAt: new Date(), version: { increment: 1 } },
    });
  });
}

/** Messages programmés et échecs récents d'une conversation, avec les droits du lecteur. */
export async function scheduledMessagesForChat(
  db: Db,
  input: { projectId: string; contactId: string; viewerId: string; role: string | null | undefined },
  now = new Date(),
): Promise<ScheduledChatMessage[]> {
  const rows = await db.scheduledMessage.findMany({
    where: {
      projectId: input.projectId,
      contactId: input.contactId,
      OR: [
        { status: "SCHEDULED" },
        {
          status: "FAILED",
          dismissedAt: null,
          failedAt: { gte: new Date(now.getTime() - LIMITS.failureVisibleMs) },
        },
      ],
    },
    orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
    take: LIMITS.perContact + 10,
    select: {
      id: true,
      content: true,
      scheduledAt: true,
      status: true,
      failureReason: true,
      version: true,
      authorId: true,
      author: { select: { id: true, name: true, image: true } },
    },
  });
  const dispatcher = can(input.role, "conversations.dispatch");
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status === "FAILED" ? "failed" : "scheduled",
    reason: row.failureReason,
    version: row.version,
    author: row.author,
    canEdit: !!row.authorId && row.authorId === input.viewerId,
    canCancel: (!!row.authorId && row.authorId === input.viewerId) || dispatcher,
  }));
}

/* -------------------------------------------------------------------------- */
/* Envoi à l'heure dite                                                        */
/* -------------------------------------------------------------------------- */

export type ScheduledTick = {
  projectId: string;
  contactId: string;
  scheduledMessageId: string;
  outcome: "sent" | "failed" | "waiting";
} | null;

/**
 * Traite au plus un message programmé arrivé à échéance. Tout est revérifié
 * sous verrou : droits de l'auteur, projet, offre et quota, fenêtre de 24 h
 * de WhatsApp. Le message rejoint ensuite la file d'envoi normale, comme un
 * envoi immédiat de son auteur. Appelé en boucle par le worker d'envoi.
 */
export async function runScheduledMessageTick(
  db: PrismaClient,
  options: { now?: Date } = {},
): Promise<ScheduledTick> {
  return db.$transaction(async (tx) => {
    const now =
      options.now ??
      (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0].now;
    const [candidate] = await tx.$queryRaw<Array<{ id: string; projectId: string; contactId: string }>>`
      SELECT id, "projectId", "contactId" FROM scheduled_message
      WHERE status = 'SCHEDULED' AND "nextAttemptAt" <= ${now}
      ORDER BY "nextAttemptAt", id
      LIMIT 1
      FOR UPDATE SKIP LOCKED`;
    if (!candidate) return null;
    // Ordre des verrous partagé avec chaque envoi : projet, puis contact.
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${candidate.projectId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM contact WHERE id = ${candidate.contactId} FOR UPDATE`;
    const item = await tx.scheduledMessage.findUniqueOrThrow({
      where: { id: candidate.id },
      include: { project: true, contact: true },
    });
    const { project, contact } = item;
    const result = (outcome: NonNullable<ScheduledTick>["outcome"]): ScheduledTick => ({
      projectId: item.projectId,
      contactId: item.contactId,
      scheduledMessageId: item.id,
      outcome,
    });
    const fail = async (reason: ScheduledFailureReason) => {
      await tx.scheduledMessage.update({
        where: { id: item.id },
        data: { status: "FAILED", failureReason: reason, failedAt: now, version: { increment: 1 } },
      });
      // Visible dans la conversation, à l'heure où l'envoi a échoué.
      await tx.contactEvent.create({
        data: {
          projectId: item.projectId,
          contactId: item.contactId,
          actorId: item.authorId,
          type: "SCHEDULED_MESSAGE_FAILED",
          detail: reason,
          createdAt: now,
        },
      });
      return result("failed");
    };

    if (project.deletionPending) return fail("PROJECT_DELETED");
    if (now.getTime() > item.scheduledAt.getTime() + LIMITS.maxLateMs) return fail("EXPIRED");
    const membership = item.authorId
      ? await tx.projectMembership.findUnique({
          where: { userId_projectId: { userId: item.authorId, projectId: item.projectId } },
          select: { role: true },
        })
      : null;
    if (!can(membership?.role, "conversations.handle")) return fail("AUTHOR_UNAUTHORIZED");
    if (!["active", "trialing"].includes(projectBillingStatus(project))) return fail("PROJECT_INACTIVE");

    // Hors de la fenêtre de 24 h, WhatsApp n'autorise plus de texte libre.
    // Le projet n'a pas de modèles de message validés : l'envoi échoue.
    const lastClient = await tx.message.findFirst({
      where: { projectId: item.projectId, contactId: item.contactId, fromMe: false, senderType: "CLIENT" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { createdAt: true },
    });
    if (!lastClient || lastClient.createdAt.getTime() + LIMITS.windowMs <= now.getTime()) {
      return fail("WINDOW_CLOSED");
    }

    if (project.instanceStatus !== "connected" || !project.instanceName) {
      await tx.scheduledMessage.update({
        where: { id: item.id },
        data: { nextAttemptAt: new Date(now.getTime() + LIMITS.retryMs), failureReason: "DISCONNECTED" },
      });
      return result("waiting");
    }

    let quota: Awaited<ReturnType<typeof reserveMessageQuota>>;
    try {
      quota = await reserveMessageQuota(tx, item.projectId);
    } catch (error) {
      if (error instanceof MessageQuotaError) {
        // Période d'accès terminée ou en attente de paiement : le projet n'est plus actif.
        return fail(error.code === "QUOTA_EXCEEDED" ? "QUOTA" : "PROJECT_INACTIVE");
      }
      throw error;
    }
    const message = await tx.message.create({
      data: {
        projectId: item.projectId,
        contactId: item.contactId,
        agentId: item.authorId,
        content: item.content,
        senderType: "AGENT",
        status: "PENDING",
        type: "TEXT",
        fromMe: true,
        source: SCHEDULED_SOURCE,
        createdAt: now,
      },
    });
    await tx.outboundJob.create({
      data: {
        projectId: item.projectId,
        messageId: message.id,
        requestId: randomUUID(),
        quotaPeriodId: quota.quotaPeriodId,
      },
    });
    // Comme un envoi immédiat : le message d'un membre est une prise en main,
    // qui invalide aussi les réponses de l'IA en préparation.
    await tx.contact.update({
      where: { id: item.contactId },
      data: { aiActive: false, aiVersion: { increment: 1 }, lastMessageAt: now },
    });
    if (contact.aiActive) {
      await tx.contactEvent.create({
        data: {
          projectId: item.projectId,
          contactId: item.contactId,
          actorId: item.authorId,
          type: "AI_PAUSED_BY_REPLY",
          createdAt: new Date(now.getTime() - 1),
        },
      });
    }
    await tx.scheduledMessage.update({
      where: { id: item.id },
      data: {
        status: "SENT",
        sentAt: now,
        messageId: message.id,
        failureReason: null,
        version: { increment: 1 },
      },
    });
    return result("sent");
  });
}
