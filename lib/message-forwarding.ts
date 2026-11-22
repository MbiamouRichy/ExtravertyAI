import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { chatContactName } from "./chat-privacy";
import { contactAvatarUrl } from "./contact-avatar";
import { reserveMessageQuota } from "./message-quota";
import { can } from "./project-permissions";
import { projectBillingStatus } from "./project-status";
import {
  FORWARD_LIMITS,
  FORWARD_SOURCE,
  type ForwardTarget,
} from "./message-forwarding-shared";
import { windowClosesAt } from "./scheduled-messages-shared";

export * from "./message-forwarding-shared";

/** Refus sûr à afficher tel quel à l'utilisateur. */
export class ForwardError extends Error {}

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Identifiant d'envoi propre à chaque conversation, dérivé de la demande :
 * un nouvel essai retrouve les envois déjà faits au lieu de les doubler.
 */
export function forwardRequestId(requestId: string, contactId: string) {
  const hex = createHash("sha256").update(`forward:${requestId}:${contactId}`).digest("hex");
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function requireHandler(db: Db, projectId: string, userId: string) {
  const membership = await db.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true },
  });
  // Même réponse pour « pas membre » et « rôle insuffisant » : rien ne fuit.
  if (!can(membership?.role, "conversations.handle")) throw new ForwardError("Accès refusé.");
}

/** Le message peut-il partir à nouveau tel quel ? Texte, ou fichier conservé par le projet. */
function forwardable(
  message: { type: string; mediaUrl: string | null; fromMe: boolean; status: string; senderType: string },
  projectId: string,
) {
  if (message.senderType === "AGENT" || message.senderType === "BOT" || message.senderType === "CLIENT") {
    if (message.fromMe && message.status === "FAILED") return false;
    if (message.type === "TEXT") return true;
    // Les fichiers reçus ne sont pas recopiés dans le stockage du projet.
    return (
      ["IMAGE", "AUDIO", "VIDEO", "DOCUMENT"].includes(message.type) &&
      !!message.mediaUrl?.startsWith(`chat-media/${projectId}/`)
    );
  }
  return false;
}

/**
 * Conversations du projet vers lesquelles transférer, les plus récentes
 * d'abord, avec l'état de leur fenêtre de 24 h. Recherche par nom seulement :
 * le numéro reste réservé aux rôles qui le voient.
 */
export async function forwardTargets(
  db: Db,
  input: { projectId: string; userId: string; excludeContactId: string; query?: string },
  now = new Date(),
): Promise<ForwardTarget[]> {
  await requireHandler(db, input.projectId, input.userId);
  const query = (input.query ?? "").trim().slice(0, 100);
  const contacts = await db.contact.findMany({
    where: {
      projectId: input.projectId,
      id: { not: input.excludeContactId },
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { pushName: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
    take: FORWARD_LIMITS.searchResults,
    select: {
      id: true,
      name: true,
      pushName: true,
      avatarKey: true,
      messages: {
        where: { fromMe: false, senderType: "CLIENT" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { createdAt: true },
      },
    },
  });
  return contacts.map((contact) => {
    const closes = windowClosesAt(contact.messages[0]?.createdAt);
    return {
      id: contact.id,
      name: chatContactName(contact),
      avatarUrl: contactAvatarUrl(input.projectId, contact.id, contact.avatarKey) ?? null,
      windowClosesAt: closes && closes.getTime() > now.getTime() ? closes.toISOString() : null,
    };
  });
}

export type ForwardInput = {
  projectId: string;
  userId: string;
  messageId: string;
  contactIds: string[];
  requestId: string;
};

/**
 * Transfère un message vers d'autres conversations du même projet, au nom du
 * membre : mêmes contrôles qu'un envoi immédiat (droits, projet actif, WhatsApp
 * connecté, quota), plus la fenêtre de 24 h de chaque destinataire. Tout ou
 * rien : un refus n'envoie à personne.
 */
export async function forwardMessage(db: PrismaClient, input: ForwardInput) {
  const contactIds = [...new Set(input.contactIds)].sort();
  if (!contactIds.length) throw new ForwardError("Choisissez au moins une conversation.");
  if (contactIds.length > FORWARD_LIMITS.maxTargets) {
    throw new ForwardError(`${FORWARD_LIMITS.maxTargets} conversations au plus par transfert.`);
  }
  return db.$transaction(async (tx) => {
    // Verrou partagé avec chaque envoi : projet, puis contacts (dans l'ordre des identifiants).
    const [locked] = await tx.$queryRaw<Array<{ now: Date }>>`
      SELECT clock_timestamp() AS now FROM project WHERE id = ${input.projectId} FOR UPDATE`;
    if (!locked) throw new ForwardError("Projet indisponible.");
    const now = locked.now;
    await requireHandler(tx, input.projectId, input.userId);
    const project = await tx.project.findUniqueOrThrow({
      where: { id: input.projectId },
      select: {
        status: true,
        automationPaused: true,
        statusBeforePause: true,
        instanceStatus: true,
        deletionPending: true,
      },
    });
    if (project.deletionPending || !["active", "trialing"].includes(projectBillingStatus(project))) {
      throw new ForwardError("Le projet n’est pas actif.");
    }
    if (project.instanceStatus !== "connected") throw new ForwardError("WhatsApp n’est pas connecté.");

    const source = await tx.message.findFirst({
      where: { id: input.messageId, projectId: input.projectId },
      select: {
        id: true,
        contactId: true,
        content: true,
        type: true,
        mediaUrl: true,
        fromMe: true,
        status: true,
        senderType: true,
      },
    });
    if (!source) throw new ForwardError("Message introuvable.");
    if (!forwardable(source, input.projectId)) {
      throw new ForwardError(
        source.type === "TEXT"
          ? "Ce message n’est pas parti : il ne peut pas être transféré."
          : "Les fichiers reçus ne peuvent pas être transférés. Enregistrez-le puis joignez-le à un nouveau message.",
      );
    }
    if (contactIds.includes(source.contactId)) {
      throw new ForwardError("Choisissez d’autres conversations que celle du message.");
    }

    const targets = await tx.$queryRaw<Array<{ id: string; aiActive: boolean; name: string | null; pushName: string | null }>>`
      SELECT id, "aiActive", name, "pushName" FROM contact
      WHERE id = ANY(${contactIds}::text[]) AND "projectId" = ${input.projectId}
      ORDER BY id
      FOR UPDATE`;
    if (targets.length !== contactIds.length) {
      throw new ForwardError("Une des conversations choisies n’est plus disponible.");
    }

    // Fenêtre de 24 h de WhatsApp : pas de texte libre à un client silencieux.
    const lastClient = await tx.message.groupBy({
      by: ["contactId"],
      where: { projectId: input.projectId, contactId: { in: contactIds }, fromMe: false, senderType: "CLIENT" },
      _max: { createdAt: true },
    });
    const closed = targets.filter((target) => {
      const last = lastClient.find((row) => row.contactId === target.id)?._max.createdAt;
      const closes = windowClosesAt(last);
      return !closes || closes.getTime() <= now.getTime();
    });
    if (closed.length) {
      const names = closed.slice(0, 2).map((target) => chatContactName(target)).join(", ");
      throw new ForwardError(
        closed.length === 1
          ? `La fenêtre de 24 h de WhatsApp est fermée pour ${names} : ce client ne vous a pas écrit depuis plus de 24 h. Retirez cette conversation.`
          : `La fenêtre de 24 h de WhatsApp est fermée pour ${names}${closed.length > 2 ? ` et ${closed.length - 2} autre${closed.length > 3 ? "s" : ""}` : ""}. Retirez ces conversations.`,
      );
    }

    let created = 0;
    let repeated = 0;
    for (const target of targets) {
      const requestId = forwardRequestId(input.requestId, target.id);
      const existing = await tx.outboundJob.findUnique({
        where: { projectId_requestId: { projectId: input.projectId, requestId } },
        select: { message: { select: { agentId: true, contactId: true, content: true } } },
      });
      if (existing) {
        if (
          existing.message.agentId !== input.userId ||
          existing.message.contactId !== target.id ||
          existing.message.content !== source.content
        ) {
          throw new ForwardError("Cet identifiant de demande a déjà été utilisé.");
        }
        repeated += 1;
        continue;
      }
      const quota = await reserveMessageQuota(tx, input.projectId);
      const message = await tx.message.create({
        data: {
          projectId: input.projectId,
          contactId: target.id,
          agentId: input.userId,
          content: source.content,
          senderType: "AGENT",
          status: "PENDING",
          type: source.type,
          mediaUrl: source.type === "TEXT" ? null : source.mediaUrl,
          fromMe: true,
          source: FORWARD_SOURCE,
        },
      });
      await tx.outboundJob.create({
        data: { projectId: input.projectId, messageId: message.id, requestId, quotaPeriodId: quota.quotaPeriodId },
      });
      // Comme un envoi immédiat : le message d'un membre est une prise en main.
      await tx.contact.update({
        where: { id: target.id },
        data: { aiActive: false, aiVersion: { increment: 1 }, lastMessageAt: message.createdAt },
      });
      if (target.aiActive) {
        await tx.contactEvent.create({
          data: {
            projectId: input.projectId,
            contactId: target.id,
            actorId: input.userId,
            type: "AI_PAUSED_BY_REPLY",
            createdAt: new Date(message.createdAt.getTime() - 1),
          },
        });
      }
      created += 1;
    }
    return { forwarded: created + repeated, created };
  });
}
