"use server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { getBillingAccess } from "@/lib/billing-access";
import { SettingsError, requireProjectAdmin } from "@/lib/project-settings";
import {
  generateSystemMessage,
  SystemAssistanceInput,
} from "@/lib/system-message-assistance";
import { reserveSystemAssistance } from "@/lib/system-assistance-limits";

export async function assistSystemMessage(input: unknown) {
  let reservationId: string | undefined;
  let completed = false;
  try {
    const parsed = SystemAssistanceInput.safeParse(input);
    if (!parsed.success)
      throw new SettingsError(
        "Vérifiez le nom de l’agent et la longueur du message (12 000 caractères maximum).",
      );
    const session = await getSession({ fresh: true });
    if (!session?.user.id)
      throw new SettingsError("Reconnectez-vous pour utiliser l’IA.");
    const { projectId, mode, config } = parsed.data;
    if (mode === "rewrite" && config.agentSystemMessage.length < 40)
      throw new SettingsError(
        "Écrivez au moins 40 caractères avant de reformuler.",
      );
    if (!process.env.OPENROUTER_API_KEY || !process.env.OPENROUTER_MODEL)
      throw new SettingsError("L’assistance IA n’est pas configurée.");
    await prisma.$transaction((tx) =>
      requireProjectAdmin(tx, projectId, session.user.id),
    );
    const access = await getBillingAccess(prisma, projectId);
    if (!access.allowed) throw new SettingsError(access.message);
    const reservation = await prisma.$transaction((tx) =>
      reserveSystemAssistance(tx, projectId, session.user.id),
    );
    reservationId = reservation.id;
    const systemMessage = await generateSystemMessage({
      mode,
      config,
      projectName: reservation.projectName,
    });
    const current = await prisma.$transaction((tx) =>
      requireProjectAdmin(tx, projectId, session.user.id),
    );
    if (current.project.deletionPending)
      throw new SettingsError("Le projet est en cours de suppression.");
    completed = true;
    return { success: true as const, systemMessage };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof SettingsError
          ? error.message
          : "L’IA n’a pas pu produire un message complet. Votre texte est conservé. Réessayez plus tard.",
    };
  } finally {
    if (reservationId) {
      const state = completed ? "completed" : "failed";
      await prisma.$executeRaw`UPDATE ai_editor_request SET state = ${state} WHERE id = ${reservationId}`.catch(
        () => {},
      );
    }
  }
}
