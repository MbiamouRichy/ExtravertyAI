"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";

const SendMessageSchema = z.object({
  projectId: z.string().cuid(),
  contactId: z.string().cuid(),
  requestId: z.string().uuid(),
  content: z.string().trim().min(1).max(4096),
});

class SendRejected extends Error {}

export async function sendWhatsAppMessage(
  input: z.infer<typeof SendMessageSchema>,
) {
  const session = await getSession();

  if (!session?.user?.id) {
    return {
      success: false as const,
      error: "Connexion requise.",
    };
  }

  const parsed = SendMessageSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false as const,
      error: "Demande invalide.",
    };
  }

  const agentId = session.user.id;
  const { projectId, contactId, requestId, content } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Tous les enqueue/reset de quota doivent respecter ce verrou.
      const locked = await tx.$queryRaw<
        Array<{ id: string; databaseNow: Date }>
      >`
                SELECT id, clock_timestamp() AS "databaseNow"
                FROM "project"
                WHERE id = ${projectId}
                FOR UPDATE
            `;

      if (!locked[0]) {
        throw new SendRejected("Projet indisponible.");
      }

      const membership = await tx.projectMembership.findUnique({
        where: {
          userId_projectId: {
            userId: agentId,
            projectId,
          },
        },
        select: { role: true },
      });

      if (!membership) {
        throw new SendRejected("Accès refusé.");
      }

      // Règle conservée depuis ton application :
      // tous les membres peuvent envoyer.
      // Si USER est un rôle de lecture seule chez toi,
      // ajoute ici une vérification OWNER / ADMIN.
      const existing = await tx.outboundJob.findUnique({
        where: {
          projectId_requestId: {
            projectId,
            requestId,
          },
        },
        include: { message: true },
      });

      if (existing) {
        if (
          existing.message.agentId !== agentId ||
          existing.message.contactId !== contactId ||
          existing.message.content !== content
        ) {
          throw new SendRejected(
            "Cet identifiant de demande a déjà été utilisé.",
          );
        }

        return {
          message: existing.message,
          state: existing.state,
        };
      }

      const project = await tx.project.findUniqueOrThrow({
        where: { id: projectId },
        select: {
          status: true,
          instanceStatus: true,
        },
      });

      if (project.status !== "active" && project.status !== "trialing") {
        throw new SendRejected("Le projet n’est pas actif.");
      }

      if (project.instanceStatus !== "connected") {
        throw new SendRejected("WhatsApp n’est pas connecté.");
      }

      const contactLock = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT id
                FROM "contact"
                WHERE id = ${contactId}
                  AND "projectId" = ${projectId}
                FOR UPDATE
            `;

      if (!contactLock[0]) {
        throw new SendRejected("Contact indisponible.");
      }

      const now = locked[0].databaseNow;

      const period = await tx.quotaPeriod.findFirst({
        where: {
          projectId,
          isCurrent: true,
          kind: project.status,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
      });

      if (!period) {
        throw new SendRejected(
          "La période de quota est indisponible ou expirée.",
        );
      }

      const quota = await tx.quotaPeriod.updateMany({
        where: {
          id: period.id,
          used: { lt: period.limit },
        },
        data: {
          used: { increment: 1 },
        },
      });

      if (quota.count !== 1) {
        throw new SendRejected("Le quota de messages est atteint.");
      }

      const message = await tx.message.create({
        data: {
          projectId,
          contactId,
          agentId,
          content,
          senderType: "AGENT",
          status: "PENDING",
          type: "TEXT",
          fromMe: true,
          source: "web_dashboard",
        },
      });

      const job = await tx.outboundJob.create({
        data: {
          projectId,
          messageId: message.id,
          requestId,
          quotaPeriodId: period.id,
        },
      });

      // Prise en main dès l'acceptation durable de l'envoi manuel.
      // Cela invalide aussi les générations IA portant une ancienne version.
      await tx.contact.update({
        where: { id: contactId },
        data: {
          aiActive: false,
          aiVersion: { increment: 1 },
          lastMessageAt: message.createdAt,
        },
      });

      // Champ de compatibilité pour tes écrans existants.
      // La référence d'admission reste QuotaPeriod.used.
      await tx.project.update({
        where: { id: projectId },
        data: {
          messageCount: period.used + 1,
        },
      });

      return {
        message,
        state: job.state,
      };
    });

    // Une erreur de notification ne doit pas transformer un enqueue
    // déjà validé en faux échec.
    try {
      revalidatePath(`/projects/${projectId}/chat`);
      await notifyChatChanged(projectId);
    } catch {
      console.error("[chat] Notification après enqueue indisponible.");
    }

    return {
      success: true as const,
      queued: true,
      requestId,
      outboundState: result.state,
      message: {
        id: result.message.id,
        status: result.message.status,
        timestamp: result.message.createdAt.toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof SendRejected) {
      return {
        success: false as const,
        error: error.message,
      };
    }

    console.error("[chat] Résultat de l’enregistrement non confirmé.");

    // Une perte de connexion à PostgreSQL lors du commit peut aussi
    // laisser le client dans le doute sur l'enregistrement.
    return {
      success: false as const,
      uncertain: true,
      requestId,
      error:
        "Enregistrement non confirmé. Réutilisez la même demande pour vérifier son résultat.",
    };
  }
}
