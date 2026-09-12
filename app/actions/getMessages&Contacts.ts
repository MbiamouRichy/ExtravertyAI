"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import {
  normalizeChatStatus,
  type ChatClient,
  type ChatMessage,
  type WorkspaceDataResponse,
} from "@/lib/chat";

// Compatibilité pour les imports de types existants.
export type { ChatClient, ChatMessage } from "@/lib/chat";

const CONTACT_LIMIT = 100;
const MESSAGE_LIMIT = 50;

export async function getWorkspaceData(
  projectId: string,
): Promise<WorkspaceDataResponse> {
  if (
    typeof projectId !== "string" ||
    projectId.length === 0 ||
    projectId.length > 200
  ) {
    return {
      success: false,
      error: "Espace de travail indisponible.",
    };
  }

  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Connexion requise.",
      };
    }

    const membership = await prisma.projectMembership.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId,
        },
      },
      select: { userId: true },
    });

    if (!membership) {
      return {
        success: false,
        error: "Espace de travail indisponible.",
      };
    }

    const rows = await prisma.contact.findMany({
      where: { projectId },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: CONTACT_LIMIT + 1,
      select: {
        id: true,
        name: true,
        pushName: true,
        phone: true,
        aiActive: true,
        createdAt: true,
        messages: {
          where: { projectId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: MESSAGE_LIMIT,
          select: {
            id: true,
            senderType: true,
            content: true,
            type: true,
            createdAt: true,
            status: true,
          },
        },
      },
    });

    const contactsLimited = rows.length > CONTACT_LIMIT;
    const contacts = rows.slice(0, CONTACT_LIMIT);

    const clients: ChatClient[] = [];
    const messages: Record<string, ChatMessage[]> = {};

    for (const contact of contacts) {
      const lastMessage = contact.messages[0];

      clients.push({
        id: contact.id,
        name:
          contact.name?.trim() ||
          contact.pushName?.trim() ||
          contact.phone ||
          "Contact",
        phone: contact.phone,
        aiActive: contact.aiActive,
        lastActivityAt: (
          lastMessage?.createdAt ?? contact.createdAt
        ).toISOString(),
        lastMessage: lastMessage
          ? lastMessage.type === "TEXT"
            ? lastMessage.content
            : `Pièce jointe · ${lastMessage.type}`
          : "Aucun message",
      });

      messages[contact.id] = [...contact.messages].reverse().map((message) => ({
        id: message.id,
        senderType:
          message.senderType === "CLIENT"
            ? "client"
            : message.senderType === "BOT"
              ? "bot"
              : message.senderType === "AGENT"
                ? "agent"
                : "system",
        content:
          message.type === "TEXT"
            ? message.content
            : `Pièce jointe (${message.type}) — aperçu non disponible.`,
        timestamp: message.createdAt.toISOString(),
        status: normalizeChatStatus(message.status),
      }));
    }

    clients.sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() -
          new Date(a.lastActivityAt).getTime() || a.id.localeCompare(b.id),
    );

    return {
      success: true,
      clients,
      messages,
      contactsLimited,
    };
  } catch {
    // Ne pas journaliser les messages ou les informations des contacts.
    console.error("[chat] Échec du chargement de l’espace de travail.");

    return {
      success: false,
      error: "Impossible de charger les conversations.",
    };
  }
}
