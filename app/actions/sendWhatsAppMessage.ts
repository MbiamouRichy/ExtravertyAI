"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";

const SendMessageSchema = z.object({
  projectId: z.string().cuid(),
  contactId: z.string().cuid(),
  content: z
    .string()
    .trim()
    .min(1, "Le message ne peut pas être vide")
    .max(4096),
});

interface EvoResponse {
  key?: { id?: string };
  [key: string]: unknown;
}

export async function sendWhatsAppMessage(
  formData: z.infer<typeof SendMessageSchema>,
) {
  try {
    const session = await getSession();
    if (!session?.user?.id)
      return { success: false, error: "Utilisateur non authentifié" };

    const agentId = session.user.id;
    const parsed = SendMessageSchema.safeParse(formData);
    if (!parsed.success) return { success: false, error: "Données invalides" };

    const { projectId, contactId, content } = parsed.data;

    const membership = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: agentId, projectId: projectId } },
      include: {
        project: {
          select: { status: true, instanceName: true, instanceStatus: true },
        },
      },
    });

    if (!membership)
      return { success: false, error: "Accès non autorisé au projet" };

    const { status, instanceName, instanceStatus } = membership.project;

    if (status === "inactive" || status === "paused") {
      return { success: false, error: "Le projet est suspendu ou inactif." };
    }

    if (!instanceName || instanceStatus !== "connected") {
      return {
        success: false,
        error: "L’instance WhatsApp n’est pas connectée.",
      };
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId, projectId: projectId },
      select: { id: true, remoteJid: true, aiActive: true },
    });

    if (!contact) return { success: false, error: "Contact introuvable." };

    const EVO_API_URL = process.env.EVOLUTION_API_URL;
    const EVO_API_KEY = process.env.EVOLUTION_API_KEY;
    if (!EVO_API_URL || !EVO_API_KEY) throw new Error("SERVER_CONFIG_ERROR");

    let isSuccess = false;
    let evoData: EvoResponse | null = null;
    const endpoint =
      `${EVO_API_URL.replace(/\/+$/, "")}/message/sendText/` +
      encodeURIComponent(instanceName);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVO_API_KEY },
        body: JSON.stringify({ number: contact.remoteJid, text: content }),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });

      isSuccess = response.ok;
      const rawText = await response.text();
      try {
        evoData = JSON.parse(rawText) as EvoResponse;
      } catch {
        evoData = { rawResponse: rawText };
      }
    } catch {
      return {
        success: false,
        uncertain: true,
        error:
          "Confirmation indisponible. Le message peut avoir été envoyé. Vérifiez la conversation avant de réessayer.",
      };
    }

    // CORRECTION : On ne throw plus d'erreur dans la transaction pour éviter le Rollback
    const result = await prisma.$transaction(async (tx) => {
      if (!isSuccess) {
        const failedMsg = await tx.message.create({
          data: {
            content,
            senderType: "AGENT",
            status: "FAILED",
            errorMessage: "PROVIDER_REJECTED",
            source: "web_dashboard",
            contactId,
            projectId,
            agentId,
            fromMe: true,
            type: "TEXT",
          },
        });
        return { ok: false, data: failedMsg };
      }

      const newMessage = await tx.message.create({
        data: {
          content,
          senderType: "AGENT",
          status: "SENT",
          source: "web_dashboard",
          contactId,
          projectId,
          agentId,
          evolutionId: evoData?.key?.id || null,
          fromMe: true,
          type: "TEXT",
        },
      });

      if (contact.aiActive) {
        await tx.contact.update({
          where: { id: contact.id },
          data: { aiActive: false },
        });
      }

      await tx.project.update({
        where: { id: projectId },
        data: { messageCount: { increment: 1 } },
      });

      return { ok: true, data: newMessage };
    });

    revalidatePath(`/projects/${projectId}/chat`);
    await notifyChatChanged(projectId);

    // Retourne le message échoué ET une erreur si !isSuccess
    if (!result.ok) {
      return {
        success: false,
        error: "Échec de l'envoi via WhatsApp.",
        message: result.data,
      };
    }

    return { success: true, message: result.data };
  } catch (error: unknown) {
    console.error("[sendWhatsAppMessage Error]:", error);
    let friendlyErrorMessage = "Une erreur inattendue est survenue.";
    if (error instanceof Error && error.message === "SERVER_CONFIG_ERROR") {
      friendlyErrorMessage = "Erreur de configuration interne du serveur.";
    }
    return { success: false, error: friendlyErrorMessage };
  }
}
