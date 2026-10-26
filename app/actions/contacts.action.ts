"use server";
import { z } from "zod";
import { getUser } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { notifyChatChanged } from "@/lib/chat-realtime";
import { requireProjectAdmin, SettingsError } from "@/lib/project-settings";
import { setContactAiState } from "./setContactAiState";
async function mutateContact(
  projectId: string,
  contactId: string,
  name?: string,
) {
  try {
    z.object({
      projectId: z.string().cuid(),
      contactId: z.string().cuid(),
    }).parse({ projectId, contactId });
    const user = await getUser();
    if (!user?.id) throw new SettingsError("Connexion requise.");
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
      const { project } = await requireProjectAdmin(tx, projectId, user.id);
      if (project.deletionPending)
        throw new SettingsError("Le projet est en cours de suppression.");
      await tx.$queryRaw`SELECT id FROM contact WHERE id = ${contactId} AND "projectId" = ${projectId} FOR UPDATE`;
      const contact = await tx.contact.findFirst({
        where: { id: contactId, projectId },
      });
      if (!contact) throw new SettingsError("Contact indisponible.");
      if (name !== undefined) {
        const value = z.string().trim().max(120).parse(name);
        await tx.contact.update({
          where: { id: contactId },
          data: { name: value || null },
        });
      } else {
        const pending = await tx.outboundJob.findFirst({
          where: {
            projectId,
            message: { contactId },
            state: { in: ["DISPATCHING", "UNCERTAIN"] },
          },
        });
        if (pending)
          throw new SettingsError(
            "Un envoi est en cours ou son résultat reste à vérifier. La suppression est temporairement indisponible.",
          );
        await tx.contact.delete({ where: { id: contactId } });
      }
    });
    revalidatePath(`/projects/${projectId}`, "layout");
    await notifyChatChanged(projectId);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof SettingsError
          ? error.message
          : "Impossible de modifier le contact.",
    };
  }
}
export async function renameContact(
  projectId: string,
  contactId: string,
  name: string,
) {
  return mutateContact(projectId, contactId, name);
}
export async function deleteContact(projectId: string, contactId: string) {
  return mutateContact(projectId, contactId);
}
export async function toggleContactAiStatus(
  projectId: string,
  contactId: string,
  newStatus: boolean,
) {
  const result = await setContactAiState({
    projectId,
    contactId,
    enabled: newStatus,
  });
  return result.success
    ? { success: true as const, aiActive: result.enabled }
    : result;
}
