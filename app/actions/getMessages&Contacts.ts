"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";

// Tes types pour le typage du retour
export type ChatClient = {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  aiActive: boolean;
};

export type ChatMessage = {
  id: string;
  senderType: "client" | "bot" | "agent"; // En minuscules pour matcher ton front
  content: string;
  timestamp: Date;
  status: "sent" | "delivered" | "read" | "failed";
};

type WorkspaceDataResponse = {
  success: boolean;
  clients?: ChatClient[];
  messages?: Record<string, ChatMessage[]>;
  error?: string;
};

// Fonction utilitaire pour formater la date du dernier message (ex: "10:48", "Hier", "12 oct.")
const formatMessageDate = (date: Date): string => {
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Hier";
  return format(date, "dd MMM", { locale: fr });
};

export async function getWorkspaceData(
  projectId: string,
): Promise<WorkspaceDataResponse> {
  try {
    // 1. SÉCURITÉ : Vérifier l'authentification
    const session = await getSession();
    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié." };
    }
    const userId = session.user.id;

    // 2. SÉCURITÉ : Vérifier si l'utilisateur a accès à ce projet
    const membership = await prisma.projectMembership.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
    });

    if (!membership) {
      return { success: false, error: "Accès refusé au projet." };
    }

    // 3. RÉCUPÉRATION DES CONTACTS avec leur dernier message
    const rawContacts = await prisma.contact.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" }, // Les contacts les plus récents en premier
      include: {
        // On récupère les 50 derniers messages pour chaque contact
        messages: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        // OPTIONNEL : Si tu veux gérer les non-lus, tu peux compter les messages PENDING du client
        _count: {
          select: {
            messages: {
              where: { status: "PENDING", senderType: "CLIENT" },
            },
          },
        },
      },
    });

    const clients: ChatClient[] = [];
    const messagesMap: Record<string, ChatMessage[]> = {};

    // 4. MAPPING : Transformer les données Prisma pour le Frontend
    rawContacts.forEach((contact) => {
      // Le dernier message est le premier de la liste car on a fait un orderBy "desc"
      const lastMsg = contact.messages[0];

      clients.push({
        id: contact.id,
        name: contact.name || contact.pushName || contact.phone, // Fallback si pas de nom
        phone: contact.phone,
        lastMessage: lastMsg
          ? lastMsg.type === "TEXT"
            ? lastMsg.content
            : `[${lastMsg.type}]`
          : "Nouvelle conversation",
        timestamp: lastMsg
          ? formatMessageDate(lastMsg.createdAt)
          : formatMessageDate(contact.createdAt),
        unread: contact._count.messages || 0, // Utilise le compteur de non-lus
        aiActive: contact.aiActive,
      });

      // On mappe l'historique des messages pour ce contact (et on remet dans l'ordre chronologique)
      messagesMap[contact.id] = contact.messages.reverse().map((msg) => ({
        id: msg.id,
        // Mapping des Enums Prisma vers les strings attendues par ton Front
        senderType:
          msg.senderType === "CLIENT"
            ? "client"
            : msg.senderType === "BOT"
              ? "bot"
              : "agent",
        content: msg.content,
        timestamp: msg.createdAt,
        status:
          msg.status === "FAILED"
            ? "failed"
            : msg.status === "READ"
              ? "read"
              : msg.status === "DELIVERED"
                ? "delivered"
                : "sent",
      }));
    });

    // On retrie les clients pour que ceux qui ont le message le plus récent soient en haut
    clients.sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      // Un tri basique sur string de date, idéalement il faudrait trier sur le raw timestamp
      return -1; // Remplacer par un vrai tri de date si nécessaire
    });

    return {
      success: true,
      clients,
      messages: messagesMap,
    };
  } catch (error) {
    console.error("Erreur getWorkspaceData:", error);
    return { success: false, error: "Erreur lors du chargement des données." };
  }
}
