"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import {
  generateConversationSummary,
  prepareSummaryHistory,
} from "@/lib/conversation-summary";

const InputSchema = z.object({
  projectId: z.string().cuid(),
  contactId: z.string().cuid(),
});
// Best-effort per-instance protection against repeated clicks; never used for authorization.
const requests = new Map<string, number>();

export async function summarizeConversation(input: unknown) {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success)
    return { success: false as const, error: "Conversation invalide." };
  try {
    const session = await getSession();
    if (!session?.user?.id)
      return { success: false as const, error: "Connexion requise." };
    const { projectId, contactId } = parsed.data;
    const membership = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId } },
      select: { id: true },
    });
    if (!membership) return { success: false as const, error: "Accès refusé." };
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, projectId, project: { deletionPending: false } },
      select: {
        id: true,
        messages: {
          where: { senderType: "CLIENT", fromMe: false },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!contact?.messages.length)
      return {
        success: false as const,
        error: "Un message du client est nécessaire pour générer un résumé.",
      };
    const now = Date.now();
    for (const [key, expiresAt] of requests)
      if (expiresAt <= now) requests.delete(key);
    if (requests.has(session.user.id))
      return {
        success: false as const,
        error: "Patientez quelques instants avant de générer un autre résumé.",
      };
    requests.set(session.user.id, now + 30_000);
    const messages = await prisma.message.findMany({
      where: {
        projectId,
        contactId,
        OR: [
          { fromMe: false },
          { status: { in: ["SENT", "DELIVERED", "READ"] } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 201,
      select: { senderType: true, content: true, type: true },
    });
    const { history, partial } = prepareSummaryHistory(messages.slice(0, 200));
    const summary = await generateConversationSummary(history);
    // Membership may have been revoked while the provider was responding.
    const stillMember = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId } },
      select: { id: true },
    });
    if (!stillMember)
      return { success: false as const, error: "Accès refusé." };
    return {
      success: true as const,
      summary,
      partial: partial || messages.length > 200,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    // Do not log provider bodies, conversation contents or credentials.
    const code =
      error instanceof Error && /^SUMMARY_[A-Z_0-9]+$/.test(error.message)
        ? error.message
        : "SUMMARY_FAILED";
    console.error("Conversation summary failed", { code });
    return {
      success: false as const,
      error:
        code === "SUMMARY_CONFIG_MISSING"
          ? "Le résumé IA n’est pas configuré sur le serveur du site. Demandez à un administrateur de vérifier la configuration IA."
          : "Le résumé est indisponible pour le moment. Réessayez dans quelques instants.",
    };
  }
}
