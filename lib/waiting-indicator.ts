import type { PrismaClient } from "../src/generated/prisma/client";
import { requireProjectAdmin } from "./project-settings";

/**
 * Active ou masque le badge « client en attente » de la messagerie.
 * Réservé aux propriétaires et administrateurs ; la modification est journalisée.
 */
export async function setWaitingTimeIndicator(
  db: PrismaClient,
  input: { projectId: string; userId: string; enabled: boolean },
) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${input.projectId} FOR UPDATE`;
    const { project } = await requireProjectAdmin(
      tx,
      input.projectId,
      input.userId,
    );
    if (project.showWaitingTime === input.enabled) return;
    await tx.project.update({
      where: { id: input.projectId },
      data: { showWaitingTime: input.enabled },
    });
    await tx.settingsAudit.create({
      data: {
        projectId: input.projectId,
        actorId: input.userId,
        action: input.enabled ? "waiting.enabled" : "waiting.disabled",
        version: project.settingsVersion,
      },
    });
  });
}
