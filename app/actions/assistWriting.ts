"use server";

import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { prepareSummaryHistory } from "@/lib/conversation-summary";
import {
  AssistanceInputSchema,
  generateWritingAssistance,
} from "@/lib/writing-assistance";
import { projectBillingStatus } from "@/lib/project-status";

// Best-effort per-instance throttling, following the conversation summary action.
const requests = new Map<string, number>();

export async function assistWriting(input: unknown) {
  const parsed = AssistanceInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false as const,
      error:
        "Demande invalide. Le brouillon doit contenir entre 1 et 6 000 caractères.",
    };
  try {
    const session = await getSession();
    if (!session?.user?.id)
      return { success: false as const, error: "Connexion requise." };
    const { projectId, contactId, mode } = parsed.data;
    const authorizedContact = () =>
      prisma.contact.findFirst({
        where: {
          id: contactId,
          projectId,
          project: {
            deletionPending: false,
            members: { some: { userId: session.user.id } },
          },
        },
        select: {
          aiActive: true,
          project: {
            select: {
              automationPaused: true,
              status: true,
              statusBeforePause: true,
              agentSystemMessage: true,
            },
          },
        },
      });
    const contact = await authorizedContact();
    if (!contact)
      return { success: false as const, error: "Conversation indisponible." };
    if (contact.aiActive && !contact.project.automationPaused)
      return {
        success: false as const,
        error:
          "Prenez la main sur la conversation pour utiliser l’assistance IA.",
      };
    if (!["active", "trialing"].includes(projectBillingStatus(contact.project)))
      return { success: false as const, error: "Le projet n’est pas actif." };
    const now = Date.now();
    for (const [key, expiry] of requests)
      if (expiry <= now) requests.delete(key);
    const requestKey = `${session.user.id}:${mode}`;
    if (requests.has(requestKey))
      return {
        success: false as const,
        error: "Patientez quelques instants avant une nouvelle demande.",
      };
    requests.set(requestKey, now + 10000);
    const messages =
      mode === "suggest"
        ? await prisma.message.findMany({
            where: {
              projectId,
              contactId,
              OR: [
                { senderType: "CLIENT", fromMe: false },
                { status: { in: ["SENT", "DELIVERED", "READ"] } },
              ],
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 40,
            select: { senderType: true, content: true, type: true },
          })
        : [];
    if (
      mode === "suggest" &&
      !messages.some((message) => message.senderType === "CLIENT")
    )
      return {
        success: false as const,
        error:
          "Un message récent du client est nécessaire pour proposer des réponses.",
      };
    const replies = await generateWritingAssistance({
      mode,
      draft: parsed.data.mode === "rewrite" ? parsed.data.draft : undefined,
      history: prepareSummaryHistory(messages).history,
      instructions:
        mode === "suggest"
          ? contact.project.agentSystemMessage.slice(0, 12000)
          : "",
    });
    const current = await authorizedContact();
    if (!current || (current.aiActive && !current.project.automationPaused))
      return {
        success: false as const,
        error: "La conversation a changé. Réessayez en mode manuel.",
      };
    return { success: true as const, replies };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error && error.message === "ASSISTANCE_CONFIG_MISSING"
          ? "L’assistance IA n’est pas configurée sur le serveur."
          : "L’assistance IA est indisponible. Réessayez dans quelques instants.",
    };
  }
}
