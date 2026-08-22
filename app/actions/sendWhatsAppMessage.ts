"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-server";

// SÉCURITÉ : Validation stricte avec nettoyage des espaces (trim)
const SendMessageSchema = z.object({
  projectId: z.string().cuid(),
  contactId: z.string().cuid(),
  content: z
    .string()
    .trim()
    .min(1, "Le message ne peut pas être vide")
    .max(4096),
});

// Typage attendu pour la réponse d'Evolution API
interface EvoResponse {
  key?: {
    id?: string;
  };
  [key: string]: unknown; // Permet d'accepter d'autres champs non prévus
}

export async function sendWhatsAppMessage(
  formData: z.infer<typeof SendMessageSchema>,
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return { success: false, error: "Utilisateur non authentifié" };
    }
    const agentId = session.user.id;

    // 1. Validation des données entrantes
    const parsed = SendMessageSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: "Données invalides" };
    }
    const { projectId, contactId, content } = parsed.data;

    // 2. SÉCURITÉ : Vérification combinée (Droits, Statut Projet, Statut Instance)
    const membership = await prisma.projectMembership.findUnique({
      where: {
        userId_projectId: { userId: agentId, projectId: projectId },
      },
      include: {
        project: {
          select: { status: true, instanceName: true, instanceStatus: true },
        },
      },
    });

    if (!membership) {
      return { success: false, error: "Accès non autorisé au projet" };
    }

    const { status, instanceName, instanceStatus } = membership.project;

    // Blocage si le projet est inactif ou en pause
    if (status === "inactive" || status === "paused") {
      return { success: false, error: "Le projet est suspendu ou inactif." };
    }

    // Blocage si l'instance WhatsApp n'est pas prête
    if (instanceStatus !== "connected") {
      return {
        success: false,
        error: "L'instance WhatsApp n'est pas connectée.",
      };
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId, projectId: projectId },
      select: { id: true, remoteJid: true, aiActive: true },
    });

    if (!contact) {
      return { success: false, error: "Contact introuvable." };
    }

    const EVO_API_URL = process.env.EVOLUTION_API_URL;
    const EVO_API_KEY = process.env.EVOLUTION_API_KEY;
    if (!EVO_API_URL || !EVO_API_KEY) {
      throw new Error("SERVER_CONFIG_ERROR"); // Volontairement générique pour le catch
    }

    // 3. Appel à Evolution API avec gestion robuste des pannes
    let isSuccess = false;
    let evoData: EvoResponse | null = null;
    let rawErrorLog = "";

    try {
      const response = await fetch(
        `${EVO_API_URL}/message/sendText/${instanceName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EVO_API_KEY,
          },
          body: JSON.stringify({
            number: contact.remoteJid,
            text: content,
          }),
        },
      );

      isSuccess = response.ok;
      const rawText = await response.text();

      // Sécurisation du parsing JSON au cas où l'API renvoie du HTML (502, 404, etc.)
      try {
        evoData = JSON.parse(rawText) as EvoResponse;
      } catch {
        evoData = { rawResponse: rawText };
      }
    } catch (networkError: unknown) {
      isSuccess = false;
      // Vérification propre du type d'erreur
      if (networkError instanceof Error) {
        rawErrorLog = networkError.message;
      } else {
        rawErrorLog = "Erreur réseau inconnue";
      }
    }

    // 4. TRANSACTION PRISMA : Enregistrement et mise à jour synchronisés
    const result = await prisma.$transaction(async (tx) => {
      if (!isSuccess) {
        // Enregistrement de l'échec
        await tx.message.create({
          data: {
            content,
            senderType: "AGENT",
            status: "FAILED",
            errorMessage: JSON.stringify(evoData || rawErrorLog),
            source: "web_dashboard",
            contactId,
            projectId,
            agentId,
            fromMe: true,
            type: "TEXT",
          },
        });
        throw new Error("API_EVOLUTION_FAILED");
      }

      // Enregistrement du succès
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

      // Handover : L'agent prend la main, on désactive le bot IA de manière garantie
      if (contact.aiActive) {
        await tx.contact.update({
          where: { id: contact.id },
          data: { aiActive: false },
        });
      }

      // Mise à jour de la facturation et des statistiques du projet
      await tx.project.update({
        where: { id: projectId },
        data: {
          messageCount: { increment: 1 },
        },
      });

      return newMessage;
    });

    revalidatePath(`/dashboard/projects/${projectId}`);
    return { success: true, message: result };
  } catch (error: unknown) {
    // 5. SÉCURITÉ : Assainissement des messages d'erreur renvoyés au frontend
    console.error("[sendWhatsAppMessage Error]:", error);

    let friendlyErrorMessage =
      "Une erreur inattendue est survenue lors de l'envoi.";

    // Typage sécurisé pour lire le message de l'erreur
    if (error instanceof Error) {
      if (error.message === "API_EVOLUTION_FAILED") {
        friendlyErrorMessage = "Échec de l'envoi du message via WhatsApp.";
      } else if (error.message === "SERVER_CONFIG_ERROR") {
        friendlyErrorMessage = "Erreur de configuration interne du serveur.";
      }
    }
    return {
      success: false,
      error: friendlyErrorMessage,
    };
  }
}
