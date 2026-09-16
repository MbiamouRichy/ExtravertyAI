import type { PrismaClient } from "../src/generated/prisma/client";
import { latestStatus, reconcileReceipt } from "./evolution-ingestion";

// Reconcile delayed echoes by exact provider ID. Never guess an uncertain send.
export async function reconcileProviderReceipts(prisma: PrismaClient) {
  const receipts = await prisma.providerReceipt.findMany({
    where: { resolved: false },
    orderBy: { updatedAt: "asc" },
    take: 50,
  });
  const changed = new Set<string>();
  for (const receipt of receipts) {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM project WHERE id = ${receipt.projectId} FOR UPDATE`;
      const current = await tx.providerReceipt.findUnique({
        where: { id: receipt.id },
      });
      if (!current || current.resolved) return;
      const job = await tx.outboundJob.findFirst({
        where: {
          projectId: receipt.projectId,
          providerMessageId: receipt.providerId,
          state: { in: ["DISPATCHING", "UNCERTAIN", "ACCEPTED"] },
        },
        include: { message: true },
      });
      if (job) {
        await tx.message.update({
          where: { id: job.messageId },
          data: {
            evolutionId: receipt.providerId,
            status: latestStatus(job.message.status, current.status),
            errorMessage: null,
          },
        });
        await tx.outboundJob.update({
          where: { id: job.id },
          data: { state: "ACCEPTED", finishedAt: new Date(), errorCode: null },
        });
      }
      if (await reconcileReceipt(tx, receipt.id)) {
        changed.add(receipt.projectId);
        return;
      }
      await tx.providerReceipt.update({
        where: { id: receipt.id },
        data: { updatedAt: new Date() },
      });
      // Echoes can arrive before sendText returns its provider ID.
      if (
        !current.remoteJid ||
        current.content === null ||
        Date.now() - current.createdAt.getTime() < 120000
      )
        return;
      const pending = await tx.outboundJob.findFirst({
        where: {
          projectId: receipt.projectId,
          message: { contact: { remoteJid: current.remoteJid } },
          state: { in: ["DISPATCHING", "UNCERTAIN"] },
        },
      });
      if (pending) {
        // Keep this evidence for operator reconciliation; no fabricated match.
        await tx.providerReceipt.update({
          where: { id: receipt.id },
          data: { updatedAt: new Date() },
        });
        return;
      }
      const contact = await tx.contact.upsert({
        where: {
          projectId_remoteJid: {
            projectId: receipt.projectId,
            remoteJid: current.remoteJid,
          },
        },
        create: {
          projectId: receipt.projectId,
          remoteJid: current.remoteJid,
          phone: current.remoteJid.split("@")[0],
          aiActive: false,
          aiVersion: 1,
          lastMessageAt: current.createdAt,
        },
        update: {
          aiActive: false,
          aiVersion: { increment: 1 },
          lastMessageAt: current.createdAt,
        },
      });
      await tx.message.create({
        data: {
          projectId: receipt.projectId,
          contactId: contact.id,
          evolutionId: receipt.providerId,
          content: current.content || "[Message WhatsApp]",
          senderType: "AGENT",
          fromMe: true,
          status: current.status,
          source: "whatsapp",
        },
      });
      await tx.providerReceipt.update({
        where: { id: receipt.id },
        data: { resolved: true },
      });
      changed.add(receipt.projectId);
    });
  }
  return changed;
}
