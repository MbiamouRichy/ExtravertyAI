import { z } from "zod";
import type { MessageStatus, Prisma } from "../src/generated/prisma/client";

export const IncomingSchema = z.object({
  key: z.object({
    id: z.string().min(1).max(250),
    remoteJid: z.string().min(1).max(250),
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
  echo?: { remoteJid: string; content: string },
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

export async function ingestMessage(
  tx: Prisma.TransactionClient,
  projectId: string,
  raw: unknown,
) {
  const msg = IncomingSchema.parse(raw);
  const { id: evolutionId, remoteJid, fromMe } = msg.key;
  if (!remoteJid.endsWith("@s.whatsapp.net") && !remoteJid.endsWith("@lid"))
    return;
  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    "";
  if (fromMe) {
    await saveReceipt(tx, projectId, evolutionId, "SENT", {
      remoteJid,
      content: text,
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
  const contact = await tx.contact.upsert({
    where: { projectId_remoteJid: { projectId, remoteJid } },
    update: {
      ...(msg.pushName ? { pushName: msg.pushName } : {}),
      lastMessageAt: new Date(),
    },
    create: {
      projectId,
      remoteJid,
      phone: remoteJid.split("@")[0],
      pushName: msg.pushName,
      lastMessageAt: new Date(),
    },
  });
  const type = msg.message.imageMessage
    ? "IMAGE"
    : msg.message.videoMessage
      ? "VIDEO"
      : msg.message.audioMessage
        ? "AUDIO"
        : msg.message.documentMessage
          ? "DOCUMENT"
          : text
            ? "TEXT"
            : "OTHER";
  const message = await tx.message.create({
    data: {
      projectId,
      contactId: contact.id,
      evolutionId,
      content: text || `[${type}]`,
      fromMe: false,
      senderType: "CLIENT",
      status: "DELIVERED",
      type,
      source: "whatsapp",
    },
  });
  const project = await tx.project.findUniqueOrThrow({
    where: { id: projectId },
  });
  // Media is visible, but only text/captions enter the text model.
  if (
    text.trim() &&
    contact.aiActive &&
    project.agentSetupCompletedAt &&
    !project.automationPaused &&
    !project.deletionPending &&
    ["active", "trialing"].includes(project.status)
  ) {
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
