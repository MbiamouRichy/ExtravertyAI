"use server";

import { getSession } from "@/lib/auth-server";
import { rolesWith } from "@/lib/project-permissions";
import prisma from "@/lib/prisma";
import { prepareSummaryHistory } from "@/lib/conversation-summary";
import {
  AssistanceInputSchema,
  generateWritingAssistance,
} from "@/lib/writing-assistance";
import { getBillingAccess } from "@/lib/billing-access";
import { z } from "zod";

/** Message clair selon la cause, sans exposer de détail technique sensible. */
function assistanceErrorMessage(code: string) {
  if (code === "ASSISTANCE_CONFIG_MISSING")
    return "L’assistance IA n’est pas configurée sur le serveur.";
  if (code === "ASSISTANCE_PROVIDER_401" || code === "ASSISTANCE_PROVIDER_403")
    return "La clé du service IA est refusée. Vérifiez la configuration du serveur.";
  if (code === "ASSISTANCE_PROVIDER_402")
    return "Les crédits du service IA sont épuisés. Rechargez le compte du fournisseur IA.";
  if (code === "ASSISTANCE_PROVIDER_429")
    return "Le service IA reçoit trop de demandes. Réessayez dans une minute.";
  if (code === "ASSISTANCE_TIMEOUT")
    return "Le service IA a mis trop de temps à répondre. Réessayez.";
  if (code === "ASSISTANCE_INVALID_RESPONSE")
    return "Le service IA a renvoyé une réponse inutilisable. Réessayez.";
  return "L’assistance IA est indisponible. Réessayez dans quelques instants.";
}

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
            members: {
              some: {
                userId: session.user.id,
                role: { in: rolesWith("conversations.handle") },
              },
            },
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
    const access = await getBillingAccess(prisma, projectId);
    if (!access.allowed)
      return { success: false as const, error: access.message };
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
            select: {
              senderType: true,
              content: true,
              type: true,
              extractedText: true,
              extractionStatus: true,
            },
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
    if (
      messages.some(
        (message) =>
          message.extractionStatus === "PENDING" ||
          message.extractionStatus === "PROCESSING",
      )
    ) {
      requests.delete(requestKey);
      return {
        success: false as const,
        error:
          "Un média est en cours d’analyse. Réessayez dans quelques instants.",
      };
    }
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
    const currentAccess = await getBillingAccess(prisma, projectId);
    if (!currentAccess.allowed)
      return { success: false as const, error: currentAccess.message };
    return { success: true as const, replies };
  } catch (error) {
    // Code seul dans les journaux : jamais le contenu de la conversation ni la clé.
    const code =
      error instanceof Error && /^ASSISTANCE_[A-Z_0-9]+$/.test(error.message)
        ? error.message
        : error instanceof Error && error.name === "TimeoutError"
          ? "ASSISTANCE_TIMEOUT"
          : error instanceof SyntaxError || error instanceof z.ZodError
            ? "ASSISTANCE_INVALID_RESPONSE"
            : "ASSISTANCE_FAILED";
    console.error("[assist] Échec de l’assistance IA", { code });
    return { success: false as const, error: assistanceErrorMessage(code) };
  }
}
