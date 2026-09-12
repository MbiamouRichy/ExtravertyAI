"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";

const InputSchema = z.object({
  projectId: z.string().min(1).max(200),
  contactId: z.string().min(1).max(200),
  enabled: z.boolean(),
});

type Result =
  | { success: true; enabled: boolean }
  | { success: false; error: string };

export async function setContactAiState(
  input: z.infer<typeof InputSchema>,
): Promise<Result> {
  const parsed = InputSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Demande invalide." };
  }

  const session = await getSession();

  if (!session?.user?.id) {
    return { success: false, error: "Connexion requise." };
  }

  const { projectId, contactId, enabled } = parsed.data;

  try {
    const membership = await prisma.projectMembership.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId,
        },
      },
      select: { role: true },
    });

    if (
      !membership ||
      (membership.role !== "OWNER" && membership.role !== "ADMIN")
    ) {
      return {
        success: false,
        error: "Vous ne pouvez pas modifier ce réglage.",
      };
    }

    const result = await prisma.contact.updateMany({
      where: {
        id: contactId,
        projectId,
      },
      data: {
        aiActive: enabled,
      },
    });

    if (result.count !== 1) {
      return {
        success: false,
        error: "Contact indisponible.",
      };
    }

    revalidatePath(`/projects/${projectId}/chat`);
    await notifyChatChanged(projectId);

    return { success: true, enabled };
  } catch {
    console.error("[chat] Échec de la modification du réglage IA.");

    return {
      success: false,
      error: "Impossible de modifier le réglage IA.",
    };
  }
}
