"use server";

import {
  cachedConversationSummary,
  summaryFingerprint,
} from "@/lib/conversation-summary-cache";
import { z } from "zod";
import { can } from "@/lib/project-permissions";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { getBillingAccess } from "@/lib/billing-access";
import {
  generateConversationSummary,
  prepareSummaryHistory,
} from "@/lib/conversation-summary";

const InputSchema = z.object({
  projectId: z.string().cuid(),
  contactId: z.string().cuid(),
});

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
      select: { role: true },
    });
    if (!can(membership?.role, "conversations.handle"))
      return { success: false as const, error: "Accès refusé." };
    const access = await getBillingAccess(prisma, projectId);
    if (!access.allowed)
      return { success: false as const, error: access.message };
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
      select: {
        id: true,
        senderType: true,
        content: true,
        type: true,
        extractedText: true,
        extractionStatus: true,
      },
    });
    if (
      messages.some(
        (message) =>
          message.extractionStatus === "PENDING" ||
          message.extractionStatus === "PROCESSING",
      )
    ) {
      return {
        success: false as const,
        error:
          "Un média est en cours d’analyse. Réessayez dans quelques instants.",
      };
    }
    const { history, partial } = prepareSummaryHistory(messages.slice(0, 200));
    const result = await cachedConversationSummary(
      prisma,
      contactId,
      summaryFingerprint(messages),
      partial || messages.length > 200,
      () => generateConversationSummary(history),
    );
    // Membership may have been revoked while the provider was responding.
    const stillMember = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId } },
      select: { role: true },
    });
    if (!can(stillMember?.role, "conversations.handle"))
      return { success: false as const, error: "Accès refusé." };
    const currentAccess = await getBillingAccess(prisma, projectId);
    if (!currentAccess.allowed)
      return { success: false as const, error: currentAccess.message };
    return {
      success: true as const,
      ...result,
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
        code === "SUMMARY_BUSY"
          ? "Un résumé est déjà en cours de génération. Réessayez dans quelques instants."
          : code === "SUMMARY_CONFIG_MISSING"
            ? "Le résumé IA n’est pas configuré sur le serveur du site. Demandez à un administrateur de vérifier la configuration IA."
            : "Le résumé est indisponible pour le moment. Réessayez dans quelques instants.",
    };
  }
}
