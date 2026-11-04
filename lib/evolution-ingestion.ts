import { z } from "zod";
import type {
  MessageStatus,
  MessageType,
  Prisma,
} from "../src/generated/prisma/client";
import { broadcastKeyword } from "./broadcast-shared";
import { applyBroadcastKeyword } from "./broadcasts";
import { isAcknowledgment } from "./conversation-end";
import { openCsatSurvey, parseCsatScore } from "./csat";
import { isTrialRestricted, trialAllowsJid } from "./trial-restrictions";
import {
  emitIntegrationEvent,
  integrationContact,
  integrationMessage,
} from "./integration-events";

export const IncomingSchema = z.object({
  key: z.object({
    id: z.string().min(1).max(250),
    remoteJid: z.string().min(1).max(250),
    // Numéro réel quand WhatsApp désigne l'expéditeur par son @lid.
    remoteJidAlt: z.string().max(250).optional(),
    senderPn: z.string().max(250).optional(),
    fromMe: z.boolean(),
  }),
  pushName: z.string().max(250).optional(),
  message: z
    .object({
      conversation: z.string().optional(),
      extendedTextMessage: z.object({ text: z.string().optional() }).optional(),
      imageMessage: z
        .object({ caption: z.string().optional() })
        .passthrough()
        .optional(),
      videoMessage: z
        .object({ caption: z.string().optional() })
        .passthrough()
        .optional(),
      audioMessage: z.unknown().optional(),
      documentMessage: z.unknown().optional(),
    })
    .passthrough()
    .optional(),
});

export function deliveryStatus(value: unknown): MessageStatus | null {
  if (value === 4 || value === "READ" || value === "PLAYED" || value === 5)
    return "READ";
  if (value === 3 || value === "DELIVERY_ACK") return "DELIVERED";
  if (value === 2 || value === "SERVER_ACK" || value === "SENT") return "SENT";
  return null;
}

export function latestStatus(
  a: MessageStatus,
  b: MessageStatus,
): MessageStatus {
  const rank = { FAILED: -1, PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3 };
  return rank[a] >= rank[b] ? a : b;
}

export async function saveReceipt(
  tx: Prisma.TransactionClient,
  projectId: string,
  providerId: string,
  status: MessageStatus,
  echo?: { remoteJid: string; content: string; type?: MessageType },
) {
  const old = await tx.providerReceipt.findUnique({
    where: { projectId_providerId: { projectId, providerId } },
  });
  await tx.providerReceipt.upsert({
    where: { projectId_providerId: { projectId, providerId } },
    create: { projectId, providerId, status, ...echo },
    update: {
      status: old ? latestStatus(old.status, status) : status,
      ...echo,
      resolved: false,
    },
  });
}

// Caller holds the project lock. Identity is never inferred from matching text.
export async function reconcileReceipt(
  tx: Prisma.TransactionClient,
  receiptId: string,
) {
  const receipt = await tx.providerReceipt.findUniqueOrThrow({
    where: { id: receiptId },
  });
  const message = await tx.message.findUnique({
    where: {
      projectId_evolutionId: {
        projectId: receipt.projectId,
        evolutionId: receipt.providerId,
      },
    },
  });
  if (!message) return false;
  if (!message.fromMe) {
    await tx.providerReceipt.update({
      where: { id: receipt.id },
      data: { resolved: true },
    });
    return true;
  }
  await tx.message.update({
    where: { id: message.id },
    data: { status: latestStatus(message.status, receipt.status) },
  });
  await tx.providerReceipt.update({
    where: { id: receipt.id },
    data: { resolved: true },
  });
  return true;
}

function emitMessageReceived(
  tx: Prisma.TransactionClient,
  projectId: string,
  contactId: string,
  message: { id: string; type: string; createdAt: Date },
  text: string,
) {
  return emitIntegrationEvent(tx, projectId, "message.received", async () => ({
    contact: await integrationContact(tx, contactId),
    message: integrationMessage(message, text),
  }));
}

/**
 * Pendant l'essai, un message d'un autre numéro que le numéro de test n'est
 * pas enregistré : ni contact, ni conversation, ni réponse de l'IA.
 */
async function trialAcceptsSender(
  tx: Prisma.TransactionClient,
  projectId: string,
  key: z.infer<typeof IncomingSchema>["key"],
) {
  const project = await tx.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      status: true,
      automationPaused: true,
      statusBeforePause: true,
      trialTestNumber: true,
      trialTestJid: true,
    },
  });
  if (!isTrialRestricted(project)) return true;
  const testNumber = [key.remoteJid, key.remoteJidAlt, key.senderPn]
    .map((jid) => jid?.split(":")[0].split("@")[0])
    .find((digits) => !!digits && digits === project.trialTestNumber);
  if (testNumber && key.remoteJid.endsWith("@lid") && project.trialTestJid !== key.remoteJid) {
    // Les réponses visent ce @lid : il devient joignable au même titre que le numéro.
    await tx.project.update({
      where: { id: projectId },
      data: { trialTestJid: key.remoteJid },
    });
    return true;
  }
  return !!testNumber || trialAllowsJid(project, key.remoteJid);
}

export async function ingestMessage(
  tx: Prisma.TransactionClient,
  projectId: string,
  raw: unknown,
) {
  const msg = IncomingSchema.parse(raw);
  for (let depth = 0; depth < 3; depth++) {
    const wrapped = msg.message?.ephemeralMessage;
    if (!wrapped || typeof wrapped !== "object" || !("message" in wrapped))
      break;
    msg.message = IncomingSchema.shape.message.parse(wrapped.message);
  }
  const { id: evolutionId, remoteJid, fromMe } = msg.key;
  if (!remoteJid.endsWith("@s.whatsapp.net") && !remoteJid.endsWith("@lid"))
    return;
  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    "";
  const type = msg.message?.imageMessage
    ? "IMAGE"
    : msg.message?.videoMessage
      ? "VIDEO"
      : msg.message?.audioMessage
        ? "AUDIO"
        : msg.message?.documentMessage
          ? "DOCUMENT"
          : text
            ? "TEXT"
            : "OTHER";
  if (fromMe) {
    await saveReceipt(tx, projectId, evolutionId, "SENT", {
      remoteJid,
      content: text,
      type,
    });
    const receipt = await tx.providerReceipt.findUniqueOrThrow({
      where: { projectId_providerId: { projectId, providerId: evolutionId } },
    });
    await reconcileReceipt(tx, receipt.id);
    return;
  }
  const existing = await tx.message.findUnique({
    where: { projectId_evolutionId: { projectId, evolutionId } },
  });
  if (existing) return;
  if (!msg.message) return;
  if (!(await trialAcceptsSender(tx, projectId, msg.key))) return;
  // A short rating answering an open survey is recorded: it neither reopens
  // the resolved conversation nor triggers an AI reply.
  const score = type === "TEXT" ? parseCsatScore(text) : null;
  // Le verrou du projet sérialise l’ingestion : un contact n’est créé qu’une fois.
  const known = await tx.contact.findUnique({
    where: { projectId_remoteJid: { projectId, remoteJid } },
    select: { id: true },
  });
  const survey = known && score ? await openCsatSurvey(tx, known.id) : null;
  if (known && survey && score) {
    await tx.contact.update({
      where: { id: known.id },
      data: {
        ...(msg.pushName ? { pushName: msg.pushName } : {}),
        lastMessageAt: new Date(),
      },
    });
    const answer = await tx.message.create({
      data: {
        projectId,
        contactId: known.id,
        evolutionId,
        content: text,
        fromMe: false,
        senderType: "CLIENT",
        status: "DELIVERED",
        type,
        source: "whatsapp",
      },
    });
    await tx.csatSurvey.update({
      where: { id: survey.id },
      data: { score, respondedAt: new Date(), responseMessageId: answer.id },
    });
    await emitMessageReceived(tx, projectId, known.id, answer, text);
    await emitIntegrationEvent(tx, projectId, "csat.received", {
      contact: await integrationContact(tx, known.id),
      score,
    });
    return;
  }
  const contact = await tx.contact.upsert({
    where: { projectId_remoteJid: { projectId, remoteJid } },
    update: {
      ...(msg.pushName ? { pushName: msg.pushName } : {}),
      lastMessageAt: new Date(),
      // Un nouveau message client rouvre une conversation résolue.
      resolvedAt: null,
      resolvedById: null,
    },
    create: {
      projectId,
      remoteJid,
      phone: remoteJid.split("@")[0],
      pushName: msg.pushName,
      lastMessageAt: new Date(),
    },
  });
  const project = await tx.project.findUniqueOrThrow({
    where: { id: projectId },
  });
  // Media jobs wait for the durable extraction before generating a reply.
  const canReply =
    (text.trim() || type === "AUDIO" || type === "IMAGE") &&
    contact.aiActive &&
    project.agentSetupCompletedAt &&
    !project.automationPaused &&
    !project.deletionPending &&
    ["active", "trialing"].includes(project.status);
  // After the end of a conversation, a bare « merci » or « d'accord » is kept
  // without a reply; any other message wakes the assistant up.
  const quietAck =
    !!canReply &&
    !!contact.aiQuietSince &&
    project.aiQuietEnabled &&
    type === "TEXT" &&
    isAcknowledgment(text);
  const message = await tx.message.create({
    data: {
      projectId,
      contactId: contact.id,
      evolutionId,
      ...(quietAck ? { aiSkip: "QUIET_ACK" as const } : {}),
      content: text || `[${type}]`,
      fromMe: false,
      senderType: "CLIENT",
      status: "DELIVERED",
      type,
      source: "whatsapp",
      ...(type === "AUDIO" || type === "IMAGE"
        ? {
            extractionStatus: "PENDING" as const,
            extractionAvailableAt: new Date(),
          }
        : {}),
    },
  });
  if (!known) {
    await emitIntegrationEvent(tx, projectId, "contact.created", async () => ({
      contact: await integrationContact(tx, contact.id),
    }));
  }
  await emitMessageReceived(tx, projectId, contact.id, message, text);
  // STOP / START answer broadcasts: recorded in the conversation, never
  // answered by the AI (START only when it changes something).
  const keyword = type === "TEXT" ? broadcastKeyword(text) : null;
  const keywordHandled = keyword
    ? (await applyBroadcastKeyword(tx, contact, keyword)) || keyword === "OPT_OUT"
    : false;
  if (canReply && !quietAck && !keywordHandled) {
    if (contact.aiQuietSince) {
      await tx.contact.update({
        where: { id: contact.id },
        data: { aiQuietSince: null },
      });
      await tx.contactEvent.create({
        data: { projectId, contactId: contact.id, type: "AI_WOKEN" },
      });
    }
    await tx.aiJob.create({
      data: {
        projectId,
        contactId: contact.id,
        messageId: message.id,
        aiVersion: contact.aiVersion,
        agentConfigVersion: project.agentConfigVersion,
      },
    });
  }
}
